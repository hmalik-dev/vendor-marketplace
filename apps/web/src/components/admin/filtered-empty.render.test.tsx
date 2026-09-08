import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { FilterWidening } from '@vendor-marketplace/shared';
import { FilteredEmpty, type ActiveFilter } from './filtered-empty';

/*
 * The counted filtered-empty state, against Pattern A of the admin delta
 * (#454). Closes #443's sixth finding.
 *
 * The fixture below is the point of this file, and it is chosen against the
 * shape this repo keeps being caught by (`verify-with-a-differently-shaped-
 * check`): **one widening reveals zero**. A fixture where every route reveals
 * rows cannot fail the requirement that a zero-count route is never offered —
 * it is the acceptance most likely to be faked by a happy fixture, so the happy
 * fixture is not used.
 */

const FILTERS: ActiveFilter[] = [
  {
    key: 'status',
    widening: 'Open cases instead',
    carried: { origin: 'chargeback', since: '7d' },
  },
  {
    key: 'origin',
    widening: 'Any origin',
    carried: { status: 'resolved', since: '7d' },
  },
  {
    key: 'since',
    widening: 'All time',
    carried: { status: 'resolved', origin: 'chargeback' },
  },
];

/**
 * Four counted, one of them **zero** — `origin` widens to nothing.
 *
 * The API drops zero-count routes before they reach the component, so the
 * honest fixture for "the API found nothing down that route" is the key being
 * absent. Both are exercised: `origin` is missing entirely, and `since` is
 * present at `0` — a defensive belt for a caller that sends what it counted
 * rather than what it decided.
 */
const WIDENINGS: FilterWidening[] = [
  { key: 'status', count: 4 },
  { key: 'since', count: 0 },
];

afterEach(cleanup);

function draw(widenings: FilterWidening[] = WIDENINGS, filters: ActiveFilter[] = FILTERS) {
  return render(
    <FilteredEmpty
      headline="No resolved chargeback cases in the last 7 days"
      path="/admin/cases"
      filters={filters}
      widenings={widenings}
    />,
  );
}

function widenNames(): string[] {
  return screen
    .getAllByRole('link')
    .map((link) => link.textContent ?? '')
    .filter((text) => text !== 'Clear all filters');
}

describe('the counted filtered-empty state', () => {
  /** 1 — the heading recites the active filters in the operator's own words. */
  it('recites the filters in the heading', () => {
    draw();

    expect(screen.getByRole('heading').textContent).toBe(
      'No resolved chargeback cases in the last 7 days',
    );
  });

  /** 2 — one line stating how many filters are narrowing the view. */
  it('says how many filters are narrowing the view', () => {
    draw();

    expect(screen.getByText(/filters are narrowing this/).textContent).toContain(
      '3 filters are narrowing this.',
    );
  });

  it('says "One filter" rather than "1 filters"', () => {
    draw([{ key: 'status', count: 4 }], [FILTERS[0] as ActiveFilter]);

    expect(screen.getByText(/narrowing this/).textContent).toContain(
      'One filter is narrowing this.',
    );
  });

  /**
   * 3 — **the requirement a happy fixture cannot test.**
   *
   * `since` was counted at zero and `origin` was not counted at all. Neither
   * may be offered: a button promising rows down a route that has none is
   * worse than no button, because the operator spends a click to learn the
   * screen was wrong.
   */
  it('never offers a route that would reveal zero', () => {
    draw();

    expect(widenNames()).toEqual(['Open cases instead (4)']);
    expect(screen.queryByText(/All time/)).toBeNull();
    expect(screen.queryByText(/Any origin/)).toBeNull();
  });

  /** Each button carries the count it would reveal, not just its own words. */
  it('carries the count on every button it does offer', () => {
    draw([
      { key: 'status', count: 4 },
      { key: 'origin', count: 2 },
      { key: 'since', count: 9 },
    ]);

    expect(widenNames()).toEqual(['All time (9)', 'Open cases instead (4)', 'Any origin (2)']);
  });

  /**
   * Highest count is the primary, and it is exactly one.
   *
   * The delta's reasoning is that this is the widening most likely to be worth
   * taking, so it is the one an operator's eye should land on. Asserted on the
   * fill rather than on order alone, because a sorted list with three filled
   * buttons recommends nothing.
   */
  it('fills only the highest-count route', () => {
    draw([
      { key: 'status', count: 4 },
      { key: 'origin', count: 2 },
      { key: 'since', count: 9 },
    ]);

    const filled = screen.getAllByRole('link').filter((link) => link.className.includes('bg-clay'));

    expect(filled).toHaveLength(1);
    expect(filled[0]?.textContent).toBe('All time (9)');
  });

  /** Each button drops **exactly** its own filter and holds the others. */
  it('drops exactly one filter per route', () => {
    draw([{ key: 'status', count: 4 }]);

    const [route] = screen.getAllByRole('link');
    const href = route?.getAttribute('href') ?? '';

    expect(href).toContain('origin=chargeback');
    expect(href).toContain('since=7d');
    expect(href).not.toContain('status=');
  });

  /** 4 — `Clear all filters` last, as a ghost link. */
  it('offers Clear all filters last, and as a ghost link', () => {
    draw();

    const links = screen.getAllByRole('link');
    const escape = links.at(-1);

    expect(escape?.textContent).toBe('Clear all filters');
    expect(escape?.getAttribute('href')).toBe('/admin/cases');
    expect(escape?.className).toContain('text-clay-500');
    expect(escape?.className).not.toContain('bg-clay');
  });

  /**
   * The sentence stays honest when no widening pays.
   *
   * "Widening any one of them finds something" is a claim about the routes
   * under it, and an operator staring at a state that promises rows and offers
   * none has been told something false on exactly the run where they most need
   * the truth. The escape is still there — it is the only way out left.
   */
  it('does not promise rows when every single widening finds none', () => {
    draw([]);

    expect(screen.getByText(/narrowing this/).textContent).toContain(
      'Widening any single one of them still finds nothing.',
    );
    expect(widenNames()).toEqual([]);
    expect(screen.getByText('Clear all filters')).toBeTruthy();
  });
});
