import { cleanup, render, screen } from '@testing-library/react';
import type { VendorCard as VendorCardData } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { VendorCard } from './vendor-card';

function vendor(overrides: Partial<VendorCardData> = {}): VendorCardData {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    businessName: 'Kessler & Co.',
    slug: 'kessler-co',
    city: 'Austin',
    state: 'TX',
    profileImageUrl: null,
    coverImageUrl: null,
    avgRating: 4.9,
    reviewCount: 127,
    startingPriceCents: 145_000,
    categories: [{ id: 'cat-1', name: 'Photography', slug: 'photography' }],
    ...overrides,
  };
}

describe('VendorCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('is a complete decision unit', () => {
    render(<VendorCard vendor={vendor()} />);

    expect(screen.getByRole('heading', { name: 'Kessler & Co.' })).toBeDefined();
    expect(screen.getByText(/4\.9/)).toBeDefined();
    expect(screen.getByText(/Austin, TX/)).toBeDefined();
    expect(screen.getByText('Photography')).toBeDefined();
    expect(screen.getByText('$1,450')).toBeDefined();
  });

  /*
   * A ratio, never a fixed height: a fixed height against a fluid card width
   * crops the same photo differently at every breakpoint, which is a cover no
   * vendor can design against. Both densities declare it, so a regression to a
   * `h-*` on either one fails here.
   */
  it.each(['compact', 'featured'] as const)(
    'gives the %s cover a 3:2 ratio, not a height',
    (density) => {
      const { container } = render(<VendorCard vendor={vendor()} density={density} />);
      const cover = container.querySelector('[class*="aspect-[3/2]"]');

      expect(cover).not.toBeNull();
      expect(cover?.className).not.toMatch(/\bh-\d/);
    },
  );

  /*
   * `30-responsive.md`: the featured vendor row drops its cover between `sm`
   * and `lg`, where the landing grid is two columns and the cover is around
   * 260px tall — four cards become two tall rows of photography stacked under
   * the search. The compact search card is unaffected; its grid is one column
   * at those widths.
   */
  it('drops the featured cover in the two-column range and keeps it elsewhere', () => {
    const { container } = render(<VendorCard vendor={vendor()} density="featured" />);
    const cover = container.querySelector('[class*="aspect-[3/2]"]');

    expect(cover?.className).toContain('sm:max-lg:hidden');
  });

  /*
   * #73 law 1. The link is `display:block` and exactly fills the card, and the
   * card is `overflow-hidden` — so an outward ring on the LINK is 100% outside
   * the clipping rect and renders nothing, while `:focus-visible` matches and
   * the computed `box-shadow` is correct. That is why this asserts which
   * element carries the ring rather than that a ring exists: the broken
   * version passed every value-based check there is.
   */
  it('carries the focus ring on the card, not on the clipped link inside it', () => {
    const { container } = render(<VendorCard vendor={vendor()} />);
    const card = container.querySelector('article');
    const link = container.querySelector('a');

    expect(card?.className).toContain('overflow-hidden');
    // Driven by the link's focus, but drawn by the element that does the
    // clipping — `overflow:hidden` clips descendants, not its own shadow.
    expect(card?.className).toContain('has-[a:focus-visible]:ring-2');
    expect(card?.className).toContain('has-[a:focus-visible]:ring-clay-400/30');
    expect(card?.className).toContain('has-[a:focus-visible]:ring-offset-2');
    expect(card?.className).toContain('has-[a:focus-visible]:ring-offset-stone-50');

    // And the link must not draw one of its own, or it is clipped again.
    expect(link?.className).toContain('focus-visible:ring-0');
  });

  it('keeps the compact search card cover at every width', () => {
    const { container } = render(<VendorCard vendor={vendor()} density="compact" />);
    const cover = container.querySelector('[class*="aspect-[3/2]"]');

    expect(cover).not.toBeNull();
    // `overflow-hidden` contains the substring, so this asserts the absence
    // of the responsive variant rather than of the word.
    expect(cover?.className).not.toContain('max-lg:hidden');
  });

  /*
   * The avatar overlaps the cover seam by half its height. With no seam to
   * overlap it must rejoin the flow, or a coverless card hangs it off its own
   * top edge.
   */
  it('returns the avatar to the flow where the cover is hidden', () => {
    const { container } = render(<VendorCard vendor={vendor()} density="featured" />);
    const avatarWrapper = container.querySelector('[class*="-top-[17px]"]');

    expect(avatarWrapper?.className).toContain('sm:max-lg:static');
  });

  it('links to the vendor profile', () => {
    render(<VendorCard vendor={vendor()} />);

    expect(screen.getByRole('link')).toHaveProperty(
      'href',
      'http://localhost:3000/vendors/kessler-co',
    );
  });

  /* Money is integer cents and only becomes a price at the display boundary. */
  it('renders the from-price without padded cents', () => {
    render(<VendorCard vendor={vendor({ startingPriceCents: 98_000 })} />);

    expect(screen.getByText('$980')).toBeDefined();
    expect(screen.queryByText('$980.00')).toBeNull();
  });

  it('says so plainly when a vendor has no price yet', () => {
    render(<VendorCard vendor={vendor({ startingPriceCents: null })} />);

    expect(screen.getByText('Contact for pricing')).toBeDefined();
    expect(screen.queryByText('From')).toBeNull();
  });

  /*
   * No invented numbers: an unreviewed vendor shows no rating rather than a
   * 0.0, which reads as a bad one.
   */
  it('shows no rating for an unreviewed vendor', () => {
    render(<VendorCard vendor={vendor({ avgRating: 0, reviewCount: 0 })} />);

    expect(screen.queryByText(/0\.0/)).toBeNull();
    expect(screen.getByText(/New/)).toBeDefined();
  });

  it('states the rating out of five for a screen reader, not just a star glyph', () => {
    render(<VendorCard vendor={vendor()} />);

    expect(screen.getByText(/out of 5, from 127 reviews/)).toBeDefined();
  });

  /*
   * D16 (#324): a result card carries **no** availability chip, at any width
   * or density. Surviving a dated filter already *is* the answer —
   * `vendor-search.dao.ts` hard-codes `availableOnDate: true` on every row of a
   * dated query — so a chip repeating it was a tautology, and the gold "scarce"
   * variant rested on a threshold nobody ever defined.
   *
   * The card cannot distinguish the two cases on its own, which is why this is
   * a deletion rather than a condition: the caller that knows something the
   * card does not passes `freeOnDate` explicitly.
   */
  it('makes no availability claim for a vendor free on the searched date', () => {
    // `availableOnDate` is what a dated query sets on every row it returns.
    // There is no longer a prop that could turn it into a chip — the search
    // grid passes nothing, and that is the point of the deletion.
    render(<VendorCard vendor={vendor({ availableOnDate: true })} />);

    expect(screen.queryByText(/^Free /)).toBeNull();
  });

  it('makes no availability claim when no date was searched', () => {
    render(<VendorCard vendor={vendor()} />);

    expect(screen.queryByText(/^Free /)).toBeNull();
  });

  /*
   * Sage survives in exactly one place on a card: the nearby-dates band, which
   * passes `freeOnDate` because it is offering a **different** date than the
   * one searched. That is the only thing that unsticks a dead-end query, so
   * the deletion above must not reach it.
   */
  it('still names an explicitly offered date, which is the nearby-dates band', () => {
    render(<VendorCard vendor={vendor()} freeOnDate="2026-06-14" density="compact" />);

    expect(screen.getByText('Free Jun 14')).toBeDefined();
  });

  /*
   * D16/D17, and `40-states.md`'s Missing cover photo group: the labelled
   * hatch is a build-time device for photography the *product* lacks. A
   * published vendor's empty cover is *their* missing content, shown to
   * *their* customers, so the card gets a plain `stone-250` ground at the
   * cover's own 3:2 and nothing inside it — no hatch, no monospace label,
   * nothing addressed to a developer.
   *
   * The cause and the fix stay in the editor, which is #360.
   */
  it('grounds a coverless vendor in stone-250 with nothing inside it', () => {
    const { container } = render(<VendorCard vendor={vendor()} />);

    const coverless = container.querySelector('[data-slot="coverless"]');

    expect(coverless).not.toBeNull();
    expect(coverless?.className).toContain('bg-stone-250');
    expect(coverless?.textContent).toBe('');
  });

  it('shows a coverless vendor no hatch and no developer-facing label', () => {
    const { container } = render(<VendorCard vendor={vendor()} />);

    expect(screen.queryByRole('img', { name: 'Placeholder for cover 3:2' })).toBeNull();
    expect(container.querySelector('[data-slot="placeholder"]')).toBeNull();
    expect(container.innerHTML).not.toContain('placeholder-hatch');
  });

  it('uses the vendor photograph when there is one', () => {
    const { container } = render(
      <VendorCard vendor={vendor({ coverImageUrl: 'https://example.test/cover.jpg' })} />,
    );

    expect(container.querySelector('[data-slot="coverless"]')).toBeNull();
    expect(container.querySelector('img[src="https://example.test/cover.jpg"]')).not.toBeNull();
  });

  it('handles a vendor with no location without leaving a stray separator', () => {
    render(<VendorCard vendor={vendor({ city: null, state: null })} />);

    expect(screen.queryByText(/·\s*$/)).toBeNull();
  });

  /*
   * The storefront editor's preview rail (#360) renders the real card at full
   * size so the preview cannot drift from the thing it previews. But frame `09`
   * draws that card as static content, and a vendor clicking their own preview
   * would be navigated off a form holding unsaved edits.
   *
   * `preview` expresses that as a contract on the card. The alternative in
   * flight was an `inert` wrapper at the call site, which works but describes
   * the constraint at the wrong end — the card is the thing that knows it is
   * "ONE control", so the card is where the exception belongs.
   */
  describe('preview', () => {
    it('drops the link, so the whole card stops being one control', () => {
      const { container } = render(<VendorCard vendor={vendor()} preview />);

      expect(container.querySelector('a')).toBeNull();
    });

    it('renders the same content it would as a link', () => {
      render(<VendorCard vendor={vendor()} preview />);

      // The name still reads, and still as the card's own heading rather than
      // as link text — a preview that lost its content would defeat the point.
      expect(screen.getByText('Kessler & Co.')).toBeDefined();
    });

    it('is a link by default, because the search grid is one control', () => {
      const { container } = render(<VendorCard vendor={vendor()} />);

      const link = container.querySelector('a');

      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('/vendors/kessler-co');
    });
  });
});
