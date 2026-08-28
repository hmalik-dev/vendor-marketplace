import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AboutPane } from './about-pane';

vi.mock('./portfolio-strip', () => ({
  PortfolioStrip: () => <div data-testid="portfolio-strip" />,
}));

afterEach(cleanup);

const BASE = {
  bio: 'Ten years photographing weddings across central Texas.',
  tagline: null,
  yearsInBusiness: null,
  completedEventCount: 0,
  serviceRadiusKm: null,
  portfolio: [],
  onSeeAllHref: '/vendors/june-harlow?tab=portfolio',
};

function tileValue(label: string): string | undefined {
  return screen.getByText(label).parentElement?.querySelector('dd')?.textContent ?? undefined;
}

describe('AboutPane — the pull-quote', () => {
  it("renders the vendor's line in quotation marks", () => {
    render(<AboutPane {...BASE} tagline="Quiet, documentary, never asks you to pose." />);

    expect(screen.getByText('“Quiet, documentary, never asks you to pose.”')).toBeDefined();
  });

  /* Absent is the common case, and an empty quote would be worse than none. */
  it('renders nothing where there is no tagline', () => {
    const { container } = render(<AboutPane {...BASE} />);

    expect(container.querySelector('.italic')).toBeNull();
  });

  it('renders it exactly as entered, neither truncated nor re-cased', () => {
    const exactly80 = 'a'.repeat(80);
    render(<AboutPane {...BASE} tagline={exactly80} />);

    expect(screen.getByText(`“${exactly80}”`)).toBeDefined();
  });

  /* Curly wrappers, so a straight quote inside reads as nested. */
  it('survives a tagline that contains its own quotes', () => {
    render(<AboutPane {...BASE} tagline={'They said "unforgettable" and meant it.'} />);

    expect(screen.getByText('“They said "unforgettable" and meant it.”')).toBeDefined();
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
  it('renders a vendor’s first year as "Less than a year"', () => {
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
