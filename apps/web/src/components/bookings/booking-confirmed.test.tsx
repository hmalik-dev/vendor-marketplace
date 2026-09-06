import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CATEGORY_SEEDS, CATEGORY_SLUGS } from '@vendor-marketplace/shared';
import { BookingConfirmed } from './booking-confirmed';
import { AVATAR_SIZES } from '@/components/ui/avatar';
import type { WireBooking } from '@/lib/wire-schemas';

function booking(overrides: Partial<WireBooking> = {}): WireBooking {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    requestId: 'req-1',
    eventDate: '2027-06-14',
    eventType: 'Wedding',
    venue: 'Barr Mansion',
    totalAmountCents: 145_000,
    status: 'confirmed',
    ...overrides,
  } as unknown as WireBooking;
}

const VENDOR = {
  slug: 'kessler-co',
  businessName: 'Kessler & Co.',
  avatarUrl: null,
  city: 'Austin, TX',
};

afterEach(cleanup);

describe('BookingConfirmed', () => {
  /*
   * The date, not the transaction. "Booking confirmed" is a receipt; the date
   * is what they bought, and frame `06` leads with it in 48px serif.
   */
  it('names the date rather than the transaction', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('June 14 is yours.');
  });

  /*
   * The column holds the slug (`wedding`), and every other read site routes it
   * through `EVENT_TYPE_LABELS`. This one printed the slug verbatim, so the
   * line under the heading read `wedding · Barr Mansion · Austin, TX` in the
   * middle of the receipt (#394).
   */
  it('writes the occasion the way a person reads it, not as the stored slug', () => {
    render(
      <BookingConfirmed
        booking={booking({ eventType: 'wedding' })}
        vendor={VENDOR}
        conversationId="conv-1"
      />,
    );

    expect(screen.getByText('Wedding · Barr Mansion · Austin, TX')).toBeDefined();
  });

  it('never reads a label off the prototype chain', () => {
    render(
      <BookingConfirmed
        booking={booking({ eventType: 'constructor' })}
        vendor={VENDOR}
        conversationId="conv-1"
      />,
    );

    expect(screen.getByText('constructor · Barr Mansion · Austin, TX')).toBeDefined();
  });

  it('falls back to the stored value for an occasion the vocabulary does not know', () => {
    render(
      <BookingConfirmed
        booking={booking({ eventType: 'Vow renewal' })}
        vendor={VENDOR}
        conversationId="conv-1"
      />,
    );

    expect(screen.getByText('Vow renewal · Barr Mansion · Austin, TX')).toBeDefined();
  });

  it('shows what was paid and the booking id support would ask for', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    expect(screen.getByText('$1,450')).toBeDefined();
    expect(screen.getByText('a1b2c3d4-0000-4000-8000-000000000001')).toBeDefined();
  });

  it('sends Message to the thread with this vendor', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    expect(screen.getByRole('link', { name: 'Message Kessler & Co.' }).getAttribute('href')).toBe(
      '/messages?conversation=conv-1',
    );
  });

  /*
   * #386. The label was `text-sage-700`, a step the theme does not define, so
   * Tailwind resolved it to its own built-in green and the button read in a
   * colour from outside the palette. `sage-600` is the darkest step the ramp
   * has and the one `01-foundations.md` records as the deviation from the
   * frame's `#3A4D33`. Pinned here because the ratchet in `design-tokens.test`
   * only proves the step exists — it passes on any defined step, including a
   * wrong one.
   */
  it('paints the primary action in the darkest sage the ramp defines', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    const message = screen.getByRole('link', { name: 'Message Kessler & Co.' });

    expect(message.className).toContain('text-sage-600');
    expect(message.className).not.toContain('text-sage-700');
  });

  /* No thread yet is not a dead control — it goes to the list. */
  it('falls back to the message list when no thread exists yet', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId={null} />);

    expect(screen.getByRole('link', { name: 'Message Kessler & Co.' }).getAttribute('href')).toBe(
      '/messages',
    );
  });

  /*
   * The revised frame `06` cut the "couples who booked Maya also booked"
   * framing: it needs pairing data the app does not have. What is left is
   * category **names**, and a count beside any of them would be exactly the
   * invented number the parity rules forbid on a public surface.
   */
  it('offers category names with no counts, filtered to this event date', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId={null} />);

    expect(screen.getByText('Still need someone for June 14?')).toBeDefined();

    const decor = screen.getByRole('link', { name: 'Decor' });
    expect(decor.getAttribute('href')).toBe('/search?category=decor&date=2027-06-14');

    for (const chip of ['Decor', 'Live music', 'Catering', 'Carts']) {
      expect(screen.getByRole('link', { name: chip }).textContent).toBe(chip);
    }
  });

  /*
   * The guard, not the illustration. Until #419 two of these four chips —
   * `live-music` and `cake` — named slugs the taxonomy has never seeded, so
   * they opened a search filtered on nothing and drew an empty grid on the one
   * screen the product celebrates. A hand-written list beside a seeded
   * taxonomy drifts silently; this is what makes it fail loudly instead.
   */
  it('points every cross-sell chip at a category the taxonomy actually seeds', () => {
    const { container } = render(
      <BookingConfirmed booking={booking()} vendor={VENDOR} conversationId={null} />,
    );

    const asked = [...container.querySelectorAll('a[href*="/search?category="]')].map((link) =>
      new URLSearchParams(link.getAttribute('href')!.split('?')[1]).get('category')!,
    );

    expect(asked.length).toBe(4);
    for (const slug of asked) {
      expect(CATEGORY_SLUGS, slug).toContain(slug);
    }
  });

  /*
   * The other half of the same drift. A chip that points at a live category
   * but calls it by a name the taxonomy has since changed is just as wrong,
   * and nothing about a slug check would catch it — so the label is derived
   * from the seed, and only `Live music` overrides it on purpose.
   */
  it('calls each category what the taxonomy calls it, bar the one deliberate word', () => {
    const { container } = render(
      <BookingConfirmed booking={booking()} vendor={VENDOR} conversationId={null} />,
    );

    const chips = [...container.querySelectorAll('a[href*="/search?category="]')].map((link) => ({
      slug: new URLSearchParams(link.getAttribute('href')!.split('?')[1]).get('category')!,
      label: link.textContent,
    }));

    for (const chip of chips) {
      const seeded = CATEGORY_SEEDS.find((seed) => seed.slug === chip.slug)!.name;

      expect(chip.label, chip.slug).toBe(chip.slug === 'entertainment' ? 'Live music' : seeded);
    }
  });

  /*
   * #413. Four type sizes were a step light against frame `06` — the sub-line
   * at `text-base` (13.5px) against 16, both buttons at `text-sm` (12.5px)
   * against 14, and the card's event line at `text-xs` (11px) against 12. Each
   * is a named step in the scale, so the assertion names the utility rather
   * than a pixel value written down twice: `type-scale-parity.test.ts` owns
   * the mapping from utility to px, and this owns which utility goes where.
   */
  it('sets the four type steps frame 06 draws', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    const subLine = screen.getByText(/has been paid into escrow/);
    expect(subLine.className).toContain('text-lg');

    for (const action of ['Message Kessler & Co.', 'View booking']) {
      expect(screen.getByRole('link', { name: action }).className).toContain('text-cta');
    }

    expect(screen.getByText('Wedding · Barr Mansion · Austin, TX').className).toContain(
      'text-meta',
    );
  });

  /*
   * `text-label` is a **size-only** token — 10.5px, and nothing else. The
   * frame's `.lbl` is `600 10.5px`, `letter-spacing:.05em`, uppercase, and
   * every other micro-label in the app writes all four utilities together.
   * These two wrote the size alone, so `Paid` and `Booking` rendered at 400 in
   * sentence case with no tracking: right size, wrong treatment, and nothing
   * that reads a font-size would have caught it.
   */
  it('gives the micro-labels the whole .lbl treatment, not just its size', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    for (const label of ['Paid', 'Booking']) {
      const node = screen.getByText(label);

      expect(node.className).toContain('text-label');
      expect(node.className).toContain('font-semibold');
      expect(node.className).toContain('tracking-label');
      expect(node.className).toContain('uppercase');
    }
  });

  /*
   * The words are the design. This line had been reworded to "before the day
   * to plan the details"; frame `06` writes the interval and what the
   * conversation is for, and the parity rules make the literal string part of
   * the contract. Only the pronoun differs from the frame — the frame names a
   * person, the product names a business.
   */
  it('reads the sub-line frame 06 writes', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    expect(screen.getByText(/has been paid into escrow/).textContent).toBe(
      'Kessler & Co. has been paid into escrow and your booking is confirmed. ' +
        "They'll message you two weeks out to plan the timeline.",
    );
  });

  /*
   * The frame draws a 50px **square** at an 11px radius; this was a 64px
   * circle. `avatar.test.tsx` pins `receipt` at 50px for every caller, but
   * nothing there says which caller asks for it — reverting this call site to
   * `size="lg"` with no radius override left the whole suite green.
   */
  it('draws the vendor thumbnail as the frame does — 50px square, 11px radius', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    const monogram = screen.getByText('KC');

    expect(monogram.style.width).toBe(`${AVATAR_SIZES.receipt}px`);
    expect(monogram.style.height).toBe(`${AVATAR_SIZES.receipt}px`);
    expect(AVATAR_SIZES.receipt).toBe(50);
    expect(monogram.className).toContain('rounded-[11px]');
    expect(monogram.className).not.toContain('rounded-full');
  });

  /*
   * `leading-prose` is the 1.6 the frame sets on this line and the token the
   * theme names for body copy. Tailwind's own `leading-relaxed` is 1.625 —
   * half a pixel out at 16px, and a second source of truth for a ratio the
   * theme already declares.
   */
  it('leads the sub-line on the prose token rather than a Tailwind default', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    const subLine = screen.getByText(/has been paid into escrow/);

    expect(subLine.className).toContain('leading-prose');
    expect(subLine.className).not.toContain('leading-relaxed');
  });

  /*
   * The three stops are the contrast ruling, not decoration.
   *
   * They are the frame's own three scaled to 80% in sRGB, and the depth is set
   * by the **narrowest** width rather than the reference one: a 150deg
   * gradient's line is `0.5W + 0.866H`, so a narrow field is a short line and
   * the centred headline spreads across more of it, reaching ground 1440 never
   * shows it. At the frame's own values the headline measures 4.04 and at 6.5%
   * deeper it still measures 3.66 at 390. Worst sample anywhere between 320
   * and 1728 at these values is 4.56, against a blanket 4.5 floor.
   *
   * jsdom paints nothing, so the ratios themselves are browser-measured and
   * recorded in `01-foundations.md`. This pins the values that were measured,
   * so lightening them is a deliberate edit to a test rather than a silent
   * regression under the floor.
   */
  it('keeps the gradient at the depth the contrast ruling measured', () => {
    const { container } = render(
      <BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />,
    );

    const field = container.querySelector('section[aria-label="Booking confirmed"]');

    expect(field?.className).toContain('bg-linear-[150deg,#627653_0%,#4B623E_55%,#3A4E31_100%]');
  });

  /*
   * The four chips sit on a **darkening** wash. The frame draws
   * `rgba(255,255,255,.14)`, which lightens the exact ground its white label
   * needs dark and cost those labels about 1.1 ratio points on its own.
   */
  it('washes the cross-sell chips darker, not lighter', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId={null} />);

    for (const chip of ['Decor', 'Live music', 'Catering', 'Carts']) {
      const link = screen.getByRole('link', { name: chip });

      expect(link.className).toContain('bg-stone-900/14');
      expect(link.className).not.toContain('bg-white/14');
    }
  });

  /*
   * The field is the whole shell below the header, not a box the length of its
   * own content. `flex-1` resolved against `main#main`, which is a block, so
   * the gradient stopped 321px short of the viewport and the chips sat flush
   * against the `overflow:hidden` edge that clipped their focus rings.
   *
   * `app-field`, not `app-shell`: it states the height once against
   * `--header-height`, and it is a **`min-height`**, so a short window or 200%
   * zoom scrolls rather than clipping this stack at both ends with no
   * scrollbar — which `04-laws.md` names as a bug outright.
   *
   * jsdom performs no layout, so the rendered height is unverified here and is
   * measured in the browser instead. This asserts the class-level fact — which
   * utility carries the sizing — because that is the half a source check can
   * establish.
   */
  it('fills the shell below the header rather than sizing to its content', () => {
    const { container } = render(
      <BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />,
    );

    const field = container.querySelector('section[aria-label="Booking confirmed"]');

    expect(field).not.toBeNull();
    expect(field?.className).toContain('app-field');
    expect(field?.className).not.toContain('app-shell');
    expect(field?.className).not.toContain('flex-1');
  });

  /*
   * #383. This hero is the one dark surface in the product, and the only place
   * that keeps an outline rather than taking the base `:focus-visible` ring:
   * clay at `/40` over a `stone-50` band is designed for the cream ground and
   * is both low-contrast and a bright halo on deep sage. What it must not do is
   * paint *both*, which is what it did — the outline plus the base rule's ring,
   * on all three controls.
   *
   * Asserted as a class-level fact. The page needs a confirmed, paid booking to
   * reach in a browser, so this is the check that runs on every commit; the
   * mechanism itself is driven for real on nine routes in
   * `e2e/focus-indicator.spec.ts`.
   */
  it('opts its three controls out of the base ring, keeping one outline each', () => {
    render(<BookingConfirmed booking={booking()} vendor={VENDOR} conversationId="conv-1" />);

    const controls = [
      screen.getByRole('link', { name: /^Message / }),
      screen.getByRole('link', { name: 'View booking' }),
      screen.getByRole('link', { name: 'Decor' }),
    ];

    for (const control of controls) {
      expect(control.getAttribute('data-focus-own'), control.textContent).not.toBeNull();
      expect(control.className).toContain('focus-visible:outline-2');
      // Without the style the width utility paints nothing at all.
      expect(control.className).toContain('focus-visible:outline-solid');
      expect(control.className).not.toContain('focus-visible:ring-');
    }
  });
});
