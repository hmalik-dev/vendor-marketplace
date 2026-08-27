import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Banner, type BannerStatus } from './banner';

describe('Banner', () => {
  afterEach(() => {
    cleanup();
  });

  /*
   * `40-states.md` states the colour rule and then says it does not bend: red
   * is never used for `pending`, gold is never used for a failure. These assert
   * the mapping the table gives, so a future edit cannot quietly recolour a
   * status.
   */
  const CASES: ReadonlyArray<[BannerStatus, string, string]> = [
    ['informational', 'bg-steel-50', 'bg-steel-600'],
    ['pending', 'bg-gold-50', 'bg-gold-400'],
    ['failed', 'bg-error-50', 'bg-error-500'],
    ['settled', 'bg-sage-50', 'bg-sage-400'],
  ];

  it.each(CASES)('paints %s with its own surface and dot', (status, surface, dot) => {
    const { container } = render(<Banner status={status}>A sentence.</Banner>);
    const banner = screen.getByRole('status');

    expect(banner.className).toContain(surface);
    expect(container.querySelector('span[aria-hidden="true"]')?.className).toContain(dot);
  });

  it('never paints a pending banner in the failure colour', () => {
    render(<Banner status="pending">Three things left before customers can find you.</Banner>);

    const banner = screen.getByRole('status');

    expect(banner.className).not.toContain('error');
    expect(banner.className).toContain('gold');
  });

  it('never paints a failure in the waiting colour', () => {
    render(
      <Banner status="failed">Your card was declined — you haven&rsquo;t been charged.</Banner>,
    );

    const banner = screen.getByRole('status');

    expect(banner.className).not.toContain('gold');
    expect(banner.className).toContain('error');
  });

  /*
   * The colour is derived from `status`, so there is no `tone` to pass and the
   * forbidden pairings are unrepresentable rather than merely discouraged. This
   * is the compile-time half of the rule: if a `tone` prop is ever added back,
   * `@ts-expect-error` stops matching and this fails.
   */
  it('offers no way to hand-pick a colour', () => {
    render(
      <Banner
        status="pending"
        // @ts-expect-error `tone` is not part of the contract — status decides it.
        tone="error"
      >
        Waiting on the vendor.
      </Banner>,
    );

    expect(screen.getByRole('status').className).toContain('gold');
  });

  it('renders a title above the sentence when one is given', () => {
    render(
      <Banner status="settled" title="Payout connected">
        You&rsquo;ll be paid the day after each event.
      </Banner>,
    );

    expect(screen.getByText('Payout connected')).toBeDefined();
    expect(screen.getByText(/paid the day after each event/)).toBeDefined();
  });
});
