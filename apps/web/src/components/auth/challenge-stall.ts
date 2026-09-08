/**
 * The bounded wait behind `/sign-up`, and the copy it surfaces — #464.
 *
 * Clerk runs a Cloudflare bot challenge before it will send
 * `POST /v1/client/sign_ups`. When the browser cannot reach
 * `challenges.cloudflare.com` **and the requests are dropped rather than
 * refused** — a privacy extension that blackholes, a corporate or school
 * network that filters silently, Cloudflare itself failing — clerk-js waits for
 * a token that never arrives. Measured on 2026-09-08 against the lane build:
 * the create request is never sent, the email and password fields and the
 * submit button all go `disabled`, and they stay that way indefinitely with
 * nothing rendered to read.
 *
 * There are two other ways for that host to be unavailable, and neither is this
 * failure. **Refused** — the request is answered with a reset — leaves Clerk to
 * give up on its own, attempt the create, and report the failure in its own
 * words with the fields live. **Reachable but unsolved** — the challenge loads
 * and declines to issue a token — leaves the card disabled exactly like the
 * dead end, and is a real failure, but not one caused by the network this copy
 * blames.
 *
 * So the check below is not "the form looks busy". It is "nothing has come back
 * from that host at all, and the form cannot be used again" — which is the only
 * reading that both matches what the message says and cannot fire over a
 * sign-up that is still working.
 */

/**
 * How long the challenge gets before the wait is called off.
 *
 * The challenge resolves in a couple of seconds when it resolves at all, so
 * this is not a race — it is the distance past "slow" at which continuing to
 * say nothing becomes the worse answer.
 */
export const SIGN_UP_CHALLENGE_TIMEOUT_MS = 15_000;

/**
 * How often the reading below is retaken, before the bound and after it.
 *
 * The wait is not a stopwatch that returns a verdict: the answer at fifteen
 * seconds can stop being true at sixteen, when Clerk finally reports something
 * of its own or the create lands. Retaking it is what lets the banner go away
 * again instead of standing over a screen that has moved on.
 */
export const SIGN_UP_CHALLENGE_RECHECK_MS = 1_000;

const CHALLENGE_TIMEOUT_SECONDS = SIGN_UP_CHALLENGE_TIMEOUT_MS / 1000;

/**
 * The approved strings, from `design/design-plan/31-content-voice.md`.
 *
 * The duration is interpolated rather than typed out: D16 rules that no
 * approved string hard-codes a duration the code derives, and this one is
 * derived from `SIGN_UP_CHALLENGE_TIMEOUT_MS` directly above it.
 *
 * `40-states.md` binds the rest. It is a failure, so it is red — `Banner`
 * derives that from `status="failed"` and there is no tone to pass wrongly. It
 * answers what happened and what to do now; the money and date questions do not
 * arise on a sign-up form. And it carries exactly one action.
 */
export const CHALLENGE_STALL_TITLE = "We couldn't finish the security check";

export const CHALLENGE_STALL_BODY =
  `It didn't answer within ${CHALLENGE_TIMEOUT_SECONDS} seconds. Ad blockers, privacy ` +
  'extensions and some work or school networks block challenges.cloudflare.com — allow ' +
  'it or switch networks, then try again.';

export const CHALLENGE_STALL_RETRY = 'Try again';

/** Anything the browser fetched from the challenge host. */
const CHALLENGE_HOST_RESOURCE = /challenges\.cloudflare\.com/;

/** Cloudflare's own widget, drawn when it wants the person to do something. */
const CHALLENGE_WIDGET = 'iframe[src*="challenges.cloudflare.com"]';

export interface StallCheck {
  /** True once Clerk holds an attempt, which means the create already landed. */
  created: boolean;
  /**
   * Whether anything from `challenges.cloudflare.com` has ever finished
   * loading in this page.
   *
   * This is the clause that keeps the message honest. Measured on 2026-09-08
   * across the three conditions, after submit:
   *
   * | condition                     | challenge resources | create sent | fields   |
   * | ----------------------------- | ------------------- | ----------- | -------- |
   * | host dropped (never answered) | 0                   | no          | disabled |
   * | host refused (reset)          | 6                   | yes         | live     |
   * | host reachable, no token      | 2                   | no          | disabled |
   *
   * Only the first row is what this error says happened, and only the first
   * row is a dead end nothing else reports. The third is a challenge the host
   * answered and then declined to solve — a different failure, with a different
   * cause, that the copy here would describe wrongly.
   *
   * It also rules out the false positive that would have mattered most. A
   * create request in flight for longer than the bound leaves the card disabled
   * with no attempt id, which is indistinguishable from the dead end on every
   * other signal — but a create in flight means a token was issued, which means
   * the host answered. Without this clause the banner would fire over a working
   * sign-up and its retry would remount the card underneath it.
   */
  challengeHostAnswered: boolean;
}

/**
 * Report when the challenge host answers anything, and keep reporting it.
 *
 * `buffered: true` replays what already landed before this ran, so a script
 * that loaded during first paint still counts. Reading
 * `getEntriesByType('resource')` directly would not be enough on its own: that
 * buffer holds 250 entries by default and drops the rest, and losing the
 * challenge entries there would read as a host that never answered.
 *
 * Returns the unsubscribe. Where `PerformanceObserver` does not exist — jsdom,
 * so every unit test in this repository — nothing is observed and the caller
 * keeps its initial answer, which is the conservative one.
 */
export function observeChallengeHost(onAnswered: () => void): () => void {
  if (typeof PerformanceObserver === 'undefined') {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    if (list.getEntries().some((entry) => CHALLENGE_HOST_RESOURCE.test(entry.name))) {
      onAnswered();
    }
  });

  observer.observe({ type: 'resource', buffered: true });

  return () => observer.disconnect();
}

/**
 * Whether the person can still act on the form.
 *
 * An empty container counts as unusable: Clerk unmounts its card on some
 * failures, and a form that is gone is no more retryable than one that is
 * disabled.
 */
function formIsUnusable(container: HTMLElement): boolean {
  const fields = [...container.querySelectorAll<HTMLInputElement>('input:not([type="hidden"])')];
  const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]');

  if (fields.length === 0) {
    return true;
  }

  return fields.every((field) => field.disabled) || (submit !== null && submit.disabled);
}

/**
 * Whether Cloudflare has escalated to a widget the person is meant to click.
 *
 * Observed on 2026-09-08 driving the happy path under a Clerk testing token:
 * submit replaced the whole card with a **Verify you are human** checkbox. The
 * card is gone and no create request has been made, so every other signal here
 * reads as the dead end — but the person has been handed something to do, and
 * fifteen seconds is not long enough to read it, let alone answer it.
 *
 * The dropped case draws no widget at all, measured the same day: the script
 * that would render one comes from the host that is not answering, so there is
 * nothing in the document to find. That is what makes this a clean separator
 * rather than a guess.
 */
function challengeIsWaitingOnThePerson(container: HTMLElement): boolean {
  const document = container.ownerDocument;

  return [...document.querySelectorAll<HTMLIFrameElement>(CHALLENGE_WIDGET)].some((widget) => {
    const box = widget.getBoundingClientRect();

    return box.width > 0 && box.height > 0;
  });
}

/**
 * The stall, as narrowly as it can be stated: nothing has come back from the
 * challenge host, Cloudflare is not asking for anything, no attempt exists, and
 * the form cannot be used again.
 *
 * Every clause is load-bearing, and each rules out a different thing that looks
 * identical from the outside: `challengeHostAnswered` rules out a challenge
 * that is working or has already failed on its own terms, the widget rules out
 * one the person is in the middle of answering, `created` rules out the
 * verification step, and usability rules out an ordinary validation error.
 *
 * **This is a live reading, not a verdict.** The caller re-evaluates it rather
 * than latching the first true, because every one of these can stop being true
 * a second later — and a banner that outlives its own cause is the product
 * talking over whatever replaced it.
 */
export function signUpStalled(container: HTMLElement | null, check: StallCheck): boolean {
  if (container === null || check.created || check.challengeHostAnswered) {
    return false;
  }

  return !challengeIsWaitingOnThePerson(container) && formIsUnusable(container);
}
