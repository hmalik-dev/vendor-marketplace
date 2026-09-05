import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME, ERROR_CODES, type ServicePackage } from '@vendor-marketplace/shared';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { viewerOn } from '@/testing/viewer-clock';
import { BookingRail } from './booking-rail';

/**
 * The rail proper, not the 768 bottom bar.
 *
 * `BookingRail` renders both compositions from one component (#371) -- the card
 * at `lg` and up, the pinned bar below it -- because they share the chosen
 * package, the chosen date and the message request in flight. jsdom applies no
 * CSS, so both are in the tree here even though a browser only ever paints one,
 * and an unscoped `screen.getByText('$1,750')` matches twice.
 *
 * `aside` carries role `complementary`; the bar is a `region`. Scoping to the
 * former is what keeps these assertions about the rail they were written for.
 */
function rail(): HTMLElement {
  return screen.getByRole('complementary');
}
import { ApiClientError } from '@/lib/api-client';

const requestMock = vi.fn();
const pushMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({ id: 'conv-1' });
  pushMock.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function servicePackage(overrides: Partial<ServicePackage> = {}): ServicePackage {
  return {
    id: 'pkg-1',
    vendorId: 'v-1',
    name: 'Half day',
    description: 'Four hours of coverage.',
    priceCents: 175_000,
    priceType: 'fixed',
    durationHours: 4,
    maxGuests: null,
    inclusions: [],
    isActive: true,
    displayOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Both rail controls are dropdowns now (#167), so a choice is two clicks rather
 * than a `selectOptions` or a typed date string.
 */
async function pickPackage(label: string): Promise<void> {
  await userEvent.click(screen.getByLabelText('Package'));
  await userEvent.click(await screen.findByRole('option', { name: label }));
}

async function pickDate(date: string): Promise<void> {
  await userEvent.click(screen.getByLabelText('Event date'));
  await userEvent.click(await screen.findByRole('gridcell', { name: new RegExp(date) }));
}

describe('BookingRail', () => {
  afterEach(() => {
    cleanup();
  });

  /*
   * The clearance for the fixed bar, asserted as the two class-level facts that
   * make it work rather than as geometry.
   *
   * jsdom performs no layout and loads no stylesheet, so the thing that
   * actually failed -- the footer's `All vendors` link sitting 12 of its 16px
   * under the bar, with its centre intercepted -- **cannot be reproduced here**
   * and is verified in a browser instead. What can be pinned is that the bar
   * still carries the marker the rule keys on, and that the rule still exists:
   * either one silently disappearing is how the overlap returns.
   */
  it('carries the marker the footer clearance rule keys on', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={0}
        serverToday={viewerOn('2026-01-01')}
        calendar={{}}
      />,
    );

    const bar = screen.getByRole('region', { name: 'Book Kessler & Co.' });

    expect(bar.hasAttribute('data-booking-bar')).toBe(true);
    expect(bar.className).toContain('fixed');
    expect(bar.className).toContain('lg:hidden');
  });

  it('is cleared by a footer rule that names that marker', () => {
    const globals = readFileSync(join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
    const rule = /body:has\(\[data-booking-bar\]\)\s*>\s*footer\s*\{[^}]*padding-bottom:/;

    expect(globals).toMatch(rule);
    // Below `lg` only: at 1024 and up the bar is `display:none` and the rail is
    // an ordinary grid column, so the footer must pay nothing.
    expect(globals).toMatch(/@media \(width < 64rem\) \{\s*body:has\(\[data-booking-bar\]\)/);
  });

  it('leads with the from-price in dollars', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={127}
        serverToday={viewerOn('2026-01-01')}
        calendar={{}}
      />,
    );

    expect(within(rail()).getByText('$1,750')).toBeDefined();
  });

  it('sends the selected package through to the request form', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={0}
        serverToday={viewerOn('2026-01-01')}
        calendar={{}}
      />,
    );

    const request = within(rail()).getByRole('link', { name: 'Request booking' });

    expect(request.getAttribute('href')).toBe('/vendors/kessler-and-co/request?package=pkg-1');
    // The reassurance line carries the frame's sentence and nothing in front
    // of it — see #114.
    expect(within(rail()).queryByText(/Messaging opens shortly/)).toBeNull();
  });

  /*
   * #110, answered by #310. This control was `disabled` under an `sr-only`
   * line reading "Messaging is not available yet", because `/messages` could
   * only open a thread that already existed — and #219 found that a customer
   * who had *just sent a request* still could not reach the vendor from
   * either surface.
   *
   * Frame `03` draws it enabled, and it now is: it opens the thread and goes
   * to it. The blocked-state copy is asserted gone rather than left behind to
   * contradict a working control.
   */
  describe('Send a message', () => {
    function renderRail(): void {
      render(
        <BookingRail
          businessName="Kessler & Co."
          slug="kessler-and-co"
          startingPriceCents={175_000}
          packages={[servicePackage()]}
          reviewCount={0}
          serverToday={viewerOn('2026-01-01')}
          calendar={{}}
        />,
      );
    }

    it('opens the thread with this vendor and goes to it', async () => {
      renderRail();
      const message = screen.getByRole('button', { name: 'Send a message' });

      expect(message).toHaveProperty('disabled', false);
      expect(message.getAttribute('aria-describedby')).toBeNull();
      expect(screen.queryByText(/Messaging is not available yet/)).toBeNull();

      await userEvent.click(message);

      expect(requestMock).toHaveBeenCalledWith('/conversations', {
        method: 'POST',
        body: { vendorSlug: 'kessler-and-co' },
        schema: expect.anything(),
      });
      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/messages?conversation=conv-1');
      });
    });

    /*
     * A signed-out visitor is sent to sign in carrying this page, not dropped
     * on a bare `/sign-in` — the profile is where they were and where the
     * button they pressed lives.
     */
    it('sends a signed-out visitor to sign in carrying this page', async () => {
      window.history.replaceState({}, '', '/vendors/kessler-and-co?date=2026-06-14');
      requestMock.mockRejectedValue(
        new ApiClientError(401, ERROR_CODES.UNAUTHORIZED, 'Session expired'),
      );
      renderRail();

      await userEvent.click(screen.getByRole('button', { name: 'Send a message' }));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith(
          `/sign-in?returnTo=${encodeURIComponent('/vendors/kessler-and-co?date=2026-06-14')}`,
        );
      });
    });

    /*
     * `40-states.md`: the failure is named beside the control that failed, in
     * the reader's words with one thing to do — and the upstream sentence is
     * not what gets printed.
     */
    it('names a failure beside the button rather than navigating', async () => {
      requestMock.mockRejectedValue(
        new ApiClientError(500, ERROR_CODES.INTERNAL_ERROR, 'Request validation failed'),
      );
      renderRail();
      const message = screen.getByRole('button', { name: 'Send a message' });

      await userEvent.click(message);

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('That did not go through. Try again in a moment.');
      expect(alert.textContent).not.toContain('Request validation failed');
      expect(pushMock).not.toHaveBeenCalled();
      // Still pressable: the retry is the one action the copy offers.
      expect(message).toHaveProperty('disabled', false);
      expect(message.getAttribute('aria-describedby')).toBe(alert.id);
    });

    /*
     * #402 made opening a thread customer-only, the way sending a request
     * already was. A vendor reading another vendor's profile can still press
     * this, and "try again in a moment" would be a lie about a refusal that
     * will never change.
     */
    it('says a refusal is about the account rather than offering a retry', async () => {
      requestMock.mockRejectedValue(new ApiClientError(403, ERROR_CODES.FORBIDDEN, 'Forbidden'));
      renderRail();

      await userEvent.click(screen.getByRole('button', { name: 'Send a message' }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('Only a customer account can start a thread with a vendor.');
      expect(pushMock).not.toHaveBeenCalled();
    });
  });

  it('omits the package when the vendor has none to choose from', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={null}
        packages={[]}
        reviewCount={0}
        serverToday={viewerOn('2026-01-01')}
        calendar={{}}
      />,
    );

    expect(within(rail()).getByRole('link', { name: 'Request booking' }).getAttribute('href')).toBe(
      '/vendors/kessler-and-co/request',
    );
  });

  it('names the vendor in the charge reassurance', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={0}
        serverToday={viewerOn('2026-01-01')}
        calendar={{}}
      />,
    );

    expect(screen.getByText(/Kessler & Co\. confirms the date first/)).toBeDefined();
  });

  /* A vendor with nothing priced gets a route to a conversation, not a blank. */
  it('says pricing is a conversation when no package is priced', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={null}
        packages={[]}
        reviewCount={0}
        serverToday={viewerOn('2026-01-01')}
        calendar={{}}
      />,
    );

    expect(screen.getByText('Contact for pricing')).toBeDefined();
    expect(screen.queryByLabelText('Package')).toBeNull();
  });

  it('re-prices the rail when a different package is chosen', async () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[
          servicePackage(),
          servicePackage({ id: 'pkg-2', name: 'Full day', priceCents: 320_000 }),
        ]}
        reviewCount={0}
        serverToday={viewerOn('2026-01-01')}
        calendar={{}}
      />,
    );

    await pickPackage('Full day — $3,200');

    expect(within(rail()).getByText('$3,200')).toBeDefined();
  });

  it('does not claim reviews a vendor has not earned', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={175_000}
        packages={[servicePackage()]}
        reviewCount={0}
        serverToday={viewerOn('2026-01-01')}
        calendar={{}}
      />,
    );

    expect(screen.getByText('Every review comes from a completed booking')).toBeDefined();
    expect(screen.queryByText(/0 reviews/)).toBeNull();
  });

  describe('the free-on line (#112)', () => {
    /*
     * A vendor publishes only the days they are NOT free, so a date absent from
     * the calendar is available — the same rule the request form applies.
     */
    function renderRail(calendar: Record<string, 'blocked' | 'booked' | 'available' | 'pending'>) {
      return render(
        <BookingRail
          businessName="Kessler & Co."
          slug="kessler-and-co"
          startingPriceCents={145_000}
          packages={[servicePackage()]}
          reviewCount={127}
          serverToday={viewerOn('2026-08-10')}
          calendar={calendar}
        />,
      );
    }

    it('names a future date the vendor has not blocked', async () => {
      renderRail({});
      await pickDate('2026-08-15');

      expect(screen.getByText('Free on August 15')).toBeDefined();
    });

    it('says nothing about a date the vendor has blocked', async () => {
      renderRail({ '2026-08-15': 'blocked' });
      await pickDate('2026-08-15');

      expect(screen.queryByText(/^Free on/)).toBeNull();
    });

    /*
     * A past date cannot be *chosen* now, which is a stronger guarantee than
     * the old one: the picker used to accept it and the line then declined to
     * say anything, where the grid now refuses the day outright (#167).
     */
    it('will not let a past date be chosen at all', async () => {
      renderRail({});
      await userEvent.click(screen.getByLabelText('Event date'));

      const past = await screen.findByRole('gridcell', { name: /2026-08-05/ });
      expect((past as HTMLButtonElement).disabled).toBe(true);
      expect(screen.queryByText(/^Free on/)).toBeNull();
    });

    it('says nothing until a date is chosen', () => {
      renderRail({});

      expect(screen.queryByText(/^Free on/)).toBeNull();
    });
  });

  describe('the charge reassurance (#114)', () => {
    /*
     * The sentence is read out of the frame rather than duplicated here, so a
     * design re-import that rewords it fails this test instead of drifting.
     * The frame writes a persona name where the app writes the real vendor.
     */
    const frameHtml = readFileSync(
      join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
      'utf8',
    );
    const literal = /text-align:center;margin-top:2px">([^<]*)</.exec(frameHtml);

    it('is exactly the frame sentence, with nothing in front of it', () => {
      expect(literal).not.toBeNull();
      const sentence = (literal as RegExpExecArray)[1] as string;

      render(
        <BookingRail
          businessName="Kessler & Co."
          slug="kessler-and-co"
          startingPriceCents={145_000}
          packages={[servicePackage()]}
          reviewCount={127}
          serverToday={viewerOn('2026-08-29')}
          calendar={{}}
        />,
      );

      const expected = sentence.replace(/Maya/, 'Kessler & Co.');
      const rendered = screen.getByText(/be charged yet/).textContent ?? '';

      // Compared character for character, apostrophe included — #115 made the
      // punctuation straight, so nothing needs normalising away any more.
      expect(rendered).toBe(expected);
    });
  });
});

/**
 * #81's first finding. "From" qualifies the vendor's cheapest package, so it is
 * true only while none is chosen. The rail kept it after a selection and read
 * "From $3,900" for a specific package, while the search card said "From
 * $1,450" for the same vendor — two numbers under one qualifier, neither
 * wrong on its own.
 */
describe('the From qualifier', () => {
  const packages = [
    servicePackage({ id: 'pkg-1', name: 'Half day', priceCents: 145_000 }),
    servicePackage({ id: 'pkg-2', name: 'Full day', priceCents: 390_000 }),
  ];

  function renderRail(): void {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={145_000}
        packages={packages}
        reviewCount={127}
        serverToday={viewerOn('2026-01-01')}
        calendar={{}}
      />,
    );
  }

  it('qualifies the starting price while no package is chosen', () => {
    renderRail();

    expect(within(rail()).getByText('From')).toBeDefined();
    expect(within(rail()).getByText('$1,450')).toBeDefined();
  });

  /*
   * `findActivePackages` orders by `displayOrder` and `startingPriceCents` is
   * `MIN(price_cents)`, so the vendor's own drag order decides which package
   * the rail opens on. A vendor who put their headline package first used to
   * open the rail on its price — frame `03` draws the from-price at rest, and
   * the `/search` card for the same vendor shows it.
   */
  it('opens on the cheapest package even when the vendor ordered a dearer one first', () => {
    render(
      <BookingRail
        businessName="Kessler & Co."
        slug="kessler-and-co"
        startingPriceCents={145_000}
        packages={[
          servicePackage({ id: 'pkg-2', name: 'Full day', priceCents: 390_000, displayOrder: 0 }),
          servicePackage({ id: 'pkg-1', name: 'Half day', priceCents: 145_000, displayOrder: 1 }),
        ]}
        reviewCount={127}
        serverToday={viewerOn('2026-01-01')}
        calendar={{}}
      />,
    );

    expect(within(rail()).getByText('$1,450')).toBeDefined();
    expect(within(rail()).getByText('From').className).not.toContain('invisible');
  });

  it('keeps the row’s height when the qualifier hides, so the price does not shift', async () => {
    renderRail();

    const before = within(rail()).getByText('From');
    expect(before.className).not.toContain('invisible');

    await pickPackage('Full day — $3,900');

    // Still in the tree, just not shown — an empty node would collapse the row.
    expect(within(rail()).getByText('From').className).toContain('invisible');
  });

  it('drops once a package is chosen, because that price is exact', async () => {
    renderRail();

    await pickPackage('Full day — $3,900');

    expect(within(rail()).getByText('$3,900')).toBeDefined();
    expect(within(rail()).getByText('From').className).toContain('invisible');
  });
});
