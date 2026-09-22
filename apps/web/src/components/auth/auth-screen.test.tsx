import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthScreen } from './auth-screen';

function renderScreen(): HTMLElement {
  const { container } = render(
    <AuthScreen headline="Let's get you set up" subhead="First — which one are you?">
      <p>form</p>
    </AuthScreen>,
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
    const { container } = render(
      <AuthScreen headline="You're on the waitlist" subhead="Saved." photo={false}>
        <p>link home</p>
      </AuthScreen>,
    );
    const screen = container.querySelector('[data-auth-screen]') as HTMLElement;

    expect(screen.querySelector('[class*="w-150"]')).toBeNull();
    expect(screen.querySelector('[class*="max-w-140"]')).not.toBeNull();
    expect(screen.querySelector('[class*="max-w-115"]')).toBeNull();
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
});
