import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHALLENGE_STALL_BODY,
  CHALLENGE_STALL_RETRY,
  CHALLENGE_STALL_TITLE,
  observeChallengeHost,
  SIGN_UP_CHALLENGE_RECHECK_MS,
  SIGN_UP_CHALLENGE_TIMEOUT_MS,
  signUpStalled,
} from './challenge-stall';

/** The dead end: nothing from the host, no attempt. */
const UNREACHABLE = { created: false, challengeHostAnswered: false };

/**
 * A Clerk card as the DOM actually holds it, in the two states that matter.
 *
 * The shape is taken from the real card measured on 2026-09-08: two visible
 * inputs and a submit button, all three of which clerk-js disables together
 * while it waits on the challenge.
 */
function clerkCard({ disabled }: { disabled: boolean }): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = `
    <form>
      <input name="emailAddress" ${disabled ? 'disabled' : ''} />
      <input name="password" ${disabled ? 'disabled' : ''} />
      <button type="submit" ${disabled ? 'disabled' : ''}>Create my account</button>
    </form>`;

  return container;
}

afterEach(() => {
  /* The widget check reads the whole document, so a leaked node from one case
     would decide the next one. */
  document.body.innerHTML = '';
});

describe('signUpStalled', () => {
  /*
   * The measured defect, exactly: the challenge host answered nothing, no
   * create was made, every control is disabled, and it stays that way.
   */
  it('is the disabled form on a page the challenge host never answered', () => {
    expect(signUpStalled(clerkCard({ disabled: true }), UNREACHABLE)).toBe(true);
  });

  /*
   * The refused-host case. Clerk gives up on the challenge, attempts the
   * create, is answered, and leaves the fields live — it has already said what
   * happened, so a second error would be the product talking over itself.
   */
  it('is not a form the person can still use', () => {
    expect(signUpStalled(clerkCard({ disabled: false }), UNREACHABLE)).toBe(false);
  });

  /*
   * The clause that keeps the message honest, and the one that rules out the
   * false positive that would matter most.
   *
   * Both of the states it excludes leave the card disabled with no attempt id,
   * so they are indistinguishable from the dead end on every other signal: a
   * create request that is merely slow (its token proves the host answered),
   * and a host that answered and then declined to solve. The first would have
   * had its retry remount the card under a live create; the second is a real
   * failure, but not the one this copy describes.
   */
  it('is never a page the challenge host has answered', () => {
    expect(
      signUpStalled(clerkCard({ disabled: true }), { created: false, challengeHostAnswered: true }),
    ).toBe(false);
  });

  /* Clerk unmounts its card on some failures. A form that is gone is no more
     retryable than one that is disabled. */
  it('counts a card that unmounted itself as unusable', () => {
    expect(signUpStalled(document.createElement('div'), UNREACHABLE)).toBe(true);
  });

  /*
   * Cloudflare escalating to a checkbox looks identical to the dead end on
   * every other signal — the card is gone, the host has not answered — and it
   * is the opposite situation: the person has been handed something to do.
   *
   * jsdom performs no layout, so the widget has to be given extent explicitly.
   * That is the whole point of the check: an unsized node is not a widget
   * anyone can see, and a zero-height iframe must not suppress the error.
   */
  it('stands down while Cloudflare is asking the person for a click', () => {
    const container = document.createElement('div');
    const widget = document.createElement('iframe');
    widget.src = 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile';
    container.append(widget);
    document.body.append(container);

    widget.getBoundingClientRect = () => ({ width: 300, height: 65 }) as DOMRect;
    expect(signUpStalled(container, UNREACHABLE)).toBe(false);

    widget.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    expect(signUpStalled(container, UNREACHABLE)).toBe(true);
  });

  /* Past the create, submit belongs to the verification step, which fails for
     its own reasons and must not be reported as a challenge that never came. */
  it('never fires once Clerk holds an attempt', () => {
    expect(
      signUpStalled(clerkCard({ disabled: true }), { created: true, challengeHostAnswered: false }),
    ).toBe(false);
  });

  it('cannot fire before the form is mounted', () => {
    expect(signUpStalled(null, UNREACHABLE)).toBe(false);
  });
});

describe('observeChallengeHost', () => {
  /**
   * A `PerformanceObserver` this test can feed. jsdom has the constructor but
   * never emits a resource entry, so the entries have to be handed in; what is
   * under test is the filter and the subscription, and the browser half is
   * pinned by the reachable-host case in `e2e/sign-up-challenge.spec.ts`.
   */
  function stubObserver(): {
    emit: (...names: string[]) => void;
    options: PerformanceObserverInit | null;
    disconnected: () => boolean;
  } {
    let callback: PerformanceObserverCallback | null = null;
    let options: PerformanceObserverInit | null = null;
    let disconnected = false;

    class Stub {
      constructor(given: PerformanceObserverCallback) {
        callback = given;
      }
      observe(given: PerformanceObserverInit): void {
        options = given;
      }
      disconnect(): void {
        disconnected = true;
      }
    }

    vi.stubGlobal('PerformanceObserver', Stub);

    return {
      emit: (...names) =>
        callback?.(
          { getEntries: () => names.map((name) => ({ name }) as PerformanceEntry) } as never,
          {} as never,
        ),
      get options() {
        return options;
      },
      disconnected: () => disconnected,
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /* `buffered` is the whole reason this is an observer rather than a read: the
     challenge script usually loads during first paint, well before the form
     mounts, and without the replay that load is invisible. */
  it('replays what already loaded, not only what loads next', () => {
    const observer = stubObserver();
    observeChallengeHost(() => {});

    expect(observer.options).toEqual({ type: 'resource', buffered: true });
  });

  it('reports the challenge host, and nothing else', () => {
    const observer = stubObserver();
    let answered = 0;
    const stop = observeChallengeHost(() => {
      answered += 1;
    });

    observer.emit('https://stirred-flea.clerk.accounts.dev/v1/client/sign_ups');
    observer.emit('http://localhost:3034/_next/static/chunks/main.js');
    expect(answered).toBe(0);

    observer.emit('https://challenges.cloudflare.com/turnstile/v0/api.js');
    expect(answered).toBe(1);

    stop();
    expect(observer.disconnected()).toBe(true);
  });

  /*
   * A browser without the API must leave the caller with its initial answer
   * rather than throw and take the whole form down with it, and must still hand
   * back a disposer the effect can call.
   */
  it('is inert, and still disposable, where the browser API is missing', () => {
    vi.stubGlobal('PerformanceObserver', undefined);

    let answered = false;
    const stop = observeChallengeHost(() => {
      answered = true;
    });

    expect(answered).toBe(false);
    expect(() => stop()).not.toThrow();
  });
});

describe('the bounded wait', () => {
  /*
   * The bound is a safety number, and every other assertion in this suite is
   * written against the constant — so nothing else in the repository would
   * notice it being cut to two seconds, which would fire the banner over
   * ordinary slow challenges. This is the floor that would notice.
   *
   * The ceiling is not arbitrary either: past about half a minute the person
   * has already decided the button is broken, which is the state #464 exists
   * to end.
   */
  it('waits long enough to mean something, and not so long it means nothing', () => {
    expect(SIGN_UP_CHALLENGE_TIMEOUT_MS).toBeGreaterThanOrEqual(10_000);
    expect(SIGN_UP_CHALLENGE_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  /* A recheck slower than the wait itself would make the reading a verdict
     again, which is the thing it exists not to be. */
  it('retakes the reading well inside the wait', () => {
    expect(SIGN_UP_CHALLENGE_RECHECK_MS).toBeLessThan(SIGN_UP_CHALLENGE_TIMEOUT_MS / 5);
  });
});

describe('the approved copy', () => {
  /*
   * D16: no approved string hard-codes a duration the code derives. The wait is
   * `SIGN_UP_CHALLENGE_TIMEOUT_MS`, so the sentence reads it — this asserts the
   * two cannot drift, which is the whole of the rule.
   */
  it('states the wait the code actually enforces', () => {
    expect(CHALLENGE_STALL_BODY).toContain(`${SIGN_UP_CHALLENGE_TIMEOUT_MS / 1000} seconds`);
  });

  /* `40-states.md`: what happened, and what to do now. Both, or it is not an
     error a person can act on. */
  it('names the cause and one thing to do about it', () => {
    expect(CHALLENGE_STALL_TITLE).toMatch(/security check/i);
    expect(CHALLENGE_STALL_BODY).toContain('challenges.cloudflare.com');
    expect(CHALLENGE_STALL_BODY).toMatch(/allow it or switch networks/);
    expect(CHALLENGE_STALL_RETRY).toBe('Try again');
  });

  /* `31-content-voice.md`: contractions always, straight apostrophes, no
     exclamation marks, and no jargon out of its banned list. */
  it('is in the product voice', () => {
    for (const line of [CHALLENGE_STALL_TITLE, CHALLENGE_STALL_BODY, CHALLENGE_STALL_RETRY]) {
      expect(line).not.toMatch(/[‘’]/);
      expect(line).not.toContain('!');
      expect(line).not.toMatch(/\b(API|webhook|session|null|entity|record|CAPTCHA)\b/i);
    }

    expect(CHALLENGE_STALL_TITLE).toContain("couldn't");
    expect(CHALLENGE_STALL_BODY).toContain("didn't");
  });
});
