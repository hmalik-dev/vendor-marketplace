import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthScreen } from './auth-screen';

function renderScreen(photo = true): HTMLElement {
  const { container } = render(
    photo ? (
      <AuthScreen headline="Let's get you set up" subhead="First — which one are you?">
        <p>form</p>
      </AuthScreen>
    ) : (
      <AuthScreen headline="You're on the waitlist" subhead="Saved." photo={false}>
        <p>link home</p>
      </AuthScreen>
    ),
  );

  return container.querySelector('[data-auth-screen]') as HTMLElement;
}

describe('AuthScreen', () => {
  afterEach(() => cleanup());

  /*
   * The clay disc bleeds 120px past the bottom-left corner. Inside the
   * scrolling column that made the role-selection state — barely half a
   * viewport of content — show a scrollbar and drag down into empty cream.
   * It hangs on the screen, which clips it, so a decoration cannot scroll.
   */
  it('hangs the decorative disc on the screen, not inside the scrolling column', () => {
    const screen = renderScreen();
    const disc = screen.querySelector('[class*="rounded-full"][class*="bg-stone-900/[.035]"]');

    expect(disc?.parentElement).toBe(screen);
    expect(screen.className).toContain('overflow-hidden');
  });

  /*
   * The column keeps its scroll for the case it exists for: a form taller than
   * the viewport must be reachable, because a centred flex child taller than
   * its container is clipped at the top rather than scrolled to.
   */
  it('keeps the column scrollable for a form that genuinely outgrows the viewport', () => {
    const column = renderScreen().querySelector('[class*="overflow-y-auto"]');

    expect(column).not.toBeNull();
    expect(column?.className).toContain('flex-1');
  });

  it('renders the marketing panel beside the form from xl only', () => {
    const panel = renderScreen().querySelector('[class*="w-150"]');

    expect(panel?.className).toContain('hidden');
    expect(panel?.className).toContain('xl:block');
  });

  /*
   * The terminal screen (frame 37, VEN-512/VEN-582): "the panel column
   * becomes the whole frame, centred, and the photograph goes — the sell is
   * over." `photo={false}` is the only way anything reaches that state, so a
   * regression here silently ships every other screen's photo panel on it.
   */
  it('drops the marketing panel and widens the column when photo is false', () => {
    const screen = renderScreen(false);

    expect(screen.querySelector('[class*="w-150"]')).toBeNull();
    expect(screen.querySelector('[class*="max-w-140"]')).not.toBeNull();
    expect(screen.querySelector('[class*="max-w-115"]')).toBeNull();
  });

  /*
   * Frame `37`: the terminal screen's clay disc is 460x460 at
   * left:-150px;bottom:-170px, alpha .03 — not the 340x340/.035 disc the other
   * auth screens draw. VEN-587 — was 340x340 at -110/-120, alpha .035.
   */
  it('draws the terminal screen clay disc at frame 37 size, position and alpha', () => {
    const screen = renderScreen(false);
    const disc = screen.querySelector('[class*="bg-stone-900/[.03]"]');

    expect(disc).not.toBeNull();
    expect(disc?.className).toContain('size-115');
    expect(disc?.className).toContain('-left-37.5');
    expect(disc?.className).toContain('-bottom-42.5');
    expect(disc?.className).not.toContain('bg-stone-900/[.035]');
  });

  /*
   * Frame `37`'s H1 is 42px/1.12/-0.01em, and its body paragraph is
   * 15.5px/1.75 with a 16px top margin and no bottom margin — the gap to the
   * divider below is the divider's own margin, not this paragraph's.
   * VEN-587 — was 32px/1.15/normal and 14px (`text-cta`) with a 22px bottom
   * margin. The tracking rides on `.display-heading` (`globals.css`) rather
   * than a restated `tracking-[-0.01em]`, which `display-type.test.ts` bans
   * next to a serif hook.
   */
  it('sets frame 37 typography on the headline and body paragraph', () => {
    const screen = renderScreen(false);
    const heading = screen.querySelector('h1');
    const body = screen.querySelector('p');

    expect(heading?.className).toContain('display-heading');
    expect(heading?.className).toContain('text-[42px]');
    expect(heading?.className).toContain('leading-[1.12]');
    expect(heading?.className).not.toContain('tracking-[-0.01em]');

    expect(body?.className).toContain('text-[15.5px]');
    expect(body?.className).toContain('leading-[1.75]');
    expect(body?.className).toContain('mt-4');
    expect(body?.className).not.toContain('mb-5.5');
    expect(body?.className).not.toContain('text-cta');
  });

  /*
   * The other four auth screens (sign-in, sign-up, reset-password,
   * forgot-password) all default to `photo={true}` and must stay
   * pixel-identical: nothing here should ship frame 37's 42px/15.5px
   * typography onto them.
   */
  it('keeps the default screens on their original headline and body typography', () => {
    const screen = renderScreen();
    const heading = screen.querySelector('h1');
    const body = screen.querySelector('p');

    expect(heading?.className).toContain('text-[32px]');
    expect(heading?.className).toContain('leading-[1.15]');
    expect(heading?.className).not.toContain('display-heading');
    expect(heading?.className).not.toContain('text-[42px]');

    expect(body?.className).toContain('text-cta');
    expect(body?.className).toContain('mb-5.5');
    expect(body?.className).not.toContain('text-[15.5px]');
  });

  /*
   * Frame `37`: 34px below the wordmark, not the 26px every other auth screen
   * draws (frame `12`) — the terminal screen's next element is the 46px
   * checkmark circle, not a form. VEN-587 — was 26px (`mb-6.5`) on every
   * screen, confirmed 8px short by a live parity-checker pass against frame 37.
   */
  it('gives the terminal screen more clearance below the wordmark than the other auth screens', () => {
    const defaultWordmark = renderScreen().querySelector('a[aria-label$="home"]')?.parentElement;
    const terminalWordmark =
      renderScreen(false).querySelector('a[aria-label$="home"]')?.parentElement;

    expect(defaultWordmark?.className).toContain('mb-6.5');
    expect(terminalWordmark?.className).toContain('mb-8.5');
    expect(terminalWordmark?.className).not.toContain('mb-6.5');
  });

  it('renders beforeHeadline between the wordmark and the headline', () => {
    const { container } = render(
      <AuthScreen
        headline="You're on the waitlist"
        subhead="Saved."
        photo={false}
        beforeHeadline={<div data-testid="settled-mark" />}
      >
        <p>link home</p>
      </AuthScreen>,
    );

    const mark = container.querySelector('[data-testid="settled-mark"]');
    const heading = container.querySelector('h1');

    expect(mark).not.toBeNull();
    expect(
      mark?.compareDocumentPosition(heading as Node) === Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(true);
  });

  // VEN-660: the auth screens hide the site header, and sign-up is where the tiers were confused.
  it('marks a staging sign-up screen, and a production one not at all', () => {
    const screenFor = (tier: string) => {
      vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', tier);
      return render(
        <AuthScreen headline="Create your account" subhead="Join.">
          <p>form</p>
        </AuthScreen>,
      ).container;
    };

    expect(screenFor('staging').querySelector('[data-testid="tier-marker"]')?.textContent).toBe(
      'Staging',
    );
    cleanup();
    expect(screenFor('production').querySelector('[data-testid="tier-marker"]')).toBeNull();
    vi.unstubAllEnvs();
  });
});
