import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_TONES } from '@/components/ui/avatar';
import { RequestSummaryRail } from './request-summary-rail';

/*
 * #422 on the rail the customer reads while committing to a price. A vendor
 * avatar whose stored object has gone drew the browser's broken-image glyph
 * directly beside the total — the one place on the site where "something here
 * is broken" costs the most.
 *
 * The rail's absent state is its own `stone-150` swatch rather than the D17
 * cover ground, and it stays that: what changes is that a *failed* load now
 * lands on the same swatch instead of a glyph.
 *
 * jsdom fetches nothing, so `fireEvent.error` stands in for the browser's own
 * event; `e2e/image-fallback.spec.ts` drives a real 404 in Chromium.
 */
afterEach(() => {
  cleanup();
});

function renderRail(avatarUrl: string | null) {
  return render(
    <RequestSummaryRail
      vendor={{
        businessName: 'Kessler & Co.',
        avatarUrl,
        avgRating: 4.9,
        reviewCount: 127,
        categoryName: 'Photography',
      }}
      servicePackage={{
        name: 'Full day',
        priceCents: 145_000,
        inclusions: ['8 hours', '400 edited photographs'],
        durationHours: 8,
      }}
      customDetails=""
      onCustomDetailsChange={vi.fn()}
      customDetailsId="brief"
      customDetailsIssue={null}
      primaryLabel="Continue to review"
      onPrimary={vi.fn()}
      submitting={false}
      blockerCount={0}
      askHref="/vendors/kessler-co"
    />,
  );
}

describe('RequestSummaryRail vendor avatar', () => {
  it('falls back to the vendor monogram when the avatar fails to load', () => {
    const { container } = renderRail('https://example.test/gone.jpg');

    fireEvent.error(container.querySelector('img[src*="gone.jpg"]')!);

    const monogram = screen.getByText('KC');

    expect(container.querySelector('img[src*="gone.jpg"]')).toBeNull();
    /* The 58px box and its 12px radius are held, so the row does not jump. */
    expect(monogram.className).toContain('size-14.5');
    expect(monogram.className).toContain('rounded-xl');
    /* Not the cover tone block: an avatar is ruled separately (D24). */
    expect(container.querySelector('[data-slot="image-fallback"]')).toBeNull();
  });

  /*
   * The grey box this replaced. A featureless swatch said nothing about who
   * was being asked, on the one page where the customer commits to a price —
   * and the same vendor already read as initials everywhere else.
   */
  it('never draws a blank swatch in place of the vendor', () => {
    const { container } = renderRail(null);

    const monogram = screen.getByText('KC');

    expect(monogram.className).not.toContain('bg-stone-150');
    expect(
      FALLBACK_TONES.some((tone) => monogram.className.includes(tone.split(' ')[0])),
      'the monogram must carry one of the two ruled avatar tones',
    ).toBe(true);
    expect(container.querySelector('.bg-stone-150')).toBeNull();
  });

  it('renders a failed avatar exactly as it renders an absent one', () => {
    const failed = renderRail('https://example.test/gone.jpg');
    fireEvent.error(failed.container.querySelector('img[src*="gone.jpg"]')!);
    const failedHtml = failed.container.innerHTML;
    cleanup();

    expect(renderRail(null).container.innerHTML).toBe(failedHtml);
  });
});
