import { cleanup, render, screen } from '@testing-library/react';
import type { ServicePackage } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { AboutPane } from './about-pane';

afterEach(cleanup);

/** A package with only the fields this pane reads; the rest are unused here. */
function servicePackage(priceCents: number, inclusions: readonly string[]): ServicePackage {
  return {
    id: `pkg-${priceCents}`,
    name: `Package ${priceCents}`,
    description: 'A package with a description long enough to pass validation.',
    priceCents,
    priceType: 'fixed',
    durationHours: null,
    maxGuests: null,
    inclusions: [...inclusions],
    isActive: true,
    displayOrder: 0,
  } as unknown as ServicePackage;
}

const BASE = {
  bio: 'Ten years photographing weddings across central Texas.',
  yearsInBusiness: null,
  completedEventCount: 0,
  serviceRadiusKm: null,
  packages: [] as readonly ServicePackage[],
  onSeePackagesHref: '/vendors/june-harlow?tab=packages',
};

function tileValue(label: string): string | undefined {
  return screen.getByText(label).parentElement?.querySelector('dd')?.textContent ?? undefined;
}

/*
 * The 2026-08-29 cover rework moves the tagline into the identity card and
 * deletes the four-up Recent work strip. Both are asserted as ABSENT here
 * rather than simply untested: the pane rendered each of them for months, and
 * a test that merely stops mentioning them would let either come back.
 */
describe('AboutPane — what the cover rework removed', () => {
  it('renders no pull-quote, even when the vendor has a tagline', () => {
    const { container } = render(<AboutPane {...BASE} />);

    expect(container.querySelector('.italic')).toBeNull();
  });

  it('renders no Recent work strip and no link into the portfolio', () => {
    render(<AboutPane {...BASE} />);

    expect(screen.queryByText('Recent work')).toBeNull();
    expect(screen.queryByText(/See all \d+/)).toBeNull();
  });
});

describe("AboutPane — What's included", () => {
  const cheapest = servicePackage(145_000, [
    'Full-day coverage, two photographers',
    'Edited gallery in four weeks, print rights included',
    'Travel inside 60 miles of Austin at no charge',
  ]);
  const dearest = servicePackage(320_000, ['Two days', 'Album', 'Second shooter']);

  it("lists the cheapest package's inclusions, not the first in the array", () => {
    render(<AboutPane {...BASE} packages={[dearest, cheapest]} />);

    expect(screen.getByText('Full-day coverage, two photographers')).toBeDefined();
    expect(screen.queryByText('Two days')).toBeNull();
  });

  it('links on to the Packages tab with the frame string', () => {
    render(<AboutPane {...BASE} packages={[cheapest]} />);

    const link = screen.getByRole('link', { name: 'See all packages →' });
    expect(link.getAttribute('href')).toBe('/vendors/june-harlow?tab=packages');
  });

  /* The frame draws three lines; a fourth would push the CTA off the pane. */
  it('draws at most three lines', () => {
    const wordy = servicePackage(100_000, ['One', 'Two', 'Three', 'Four', 'Five']);
    render(<AboutPane {...BASE} packages={[wordy]} />);

    expect(screen.queryByText('Four')).toBeNull();
    expect(screen.getByText('Three')).toBeDefined();
  });

  /*
   * Absent rather than empty. A heading over nothing states a promise the page
   * cannot keep, and it is the common case for a vendor mid-setup.
   */
  it('renders nothing at all when the vendor has listed no inclusions', () => {
    render(<AboutPane {...BASE} packages={[servicePackage(100_000, [])]} />);

    expect(screen.queryByText("What's included")).toBeNull();
  });

  it('renders nothing at all when the vendor has no packages', () => {
    render(<AboutPane {...BASE} />);

    expect(screen.queryByText("What's included")).toBeNull();
  });
});

describe('AboutPane — the stat tiles', () => {
  it('names the three the plan names, in order', () => {
    render(
      <AboutPane {...BASE} yearsInBusiness={10} completedEventCount={127} serviceRadiusKm={50} />,
    );

    const labels = Array.from(document.querySelectorAll('dt')).map((node) => node.textContent);
    expect(labels).toEqual(['Experience', 'Events', 'Travels']);
  });

  /* A "Replies" tile is deferred by 12-vendor-profile.md — it is not true on
     the first day a profile is published the way the other three are. */
  it('draws no Replies tile', () => {
    render(
      <AboutPane {...BASE} yearsInBusiness={10} completedEventCount={127} serviceRadiusKm={50} />,
    );

    expect(screen.queryByText('Replies in')).toBeNull();
  });

  it('renders the experience figure in years', () => {
    render(<AboutPane {...BASE} yearsInBusiness={10} />);

    expect(tileValue('Experience')).toBe('10 yrs');
  });

  it('says a single year in the singular', () => {
    render(<AboutPane {...BASE} yearsInBusiness={1} />);

    expect(tileValue('Experience')).toBe('1 yr');
  });

  /*
   * Zero is a real answer. "0 yrs" reads as a data error where "Less than a
   * year" reads as a new business, which is what it is.
   */
  it('renders a vendor first year as "Less than a year"', () => {
    render(<AboutPane {...BASE} yearsInBusiness={0} />);

    expect(tileValue('Experience')).toBe('Less than a year');
  });

  it('omits the tile entirely when the vendor has not said', () => {
    render(<AboutPane {...BASE} completedEventCount={127} serviceRadiusKm={50} />);

    expect(screen.queryByText('Experience')).toBeNull();
  });

  /* Two tiles is a valid state, and so is one. */
  it('renders two tiles when only two are answered', () => {
    render(<AboutPane {...BASE} yearsInBusiness={4} serviceRadiusKm={50} />);

    expect(document.querySelectorAll('dt')).toHaveLength(2);
  });

  it('renders no tile row at all when nothing is answered', () => {
    render(<AboutPane {...BASE} />);

    expect(document.querySelector('dl')).toBeNull();
  });
});
