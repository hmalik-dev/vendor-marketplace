import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OutOfRange } from './out-of-range';
import { Pager } from './pager';

afterEach(cleanup);

const BASE = { path: '/admin/payments', params: { flag: 'payout-failing' }, pageSize: 15 };

describe('Pager', () => {
  it('states the window on a page that has rows', () => {
    render(<Pager {...BASE} page={2} total={31} />);

    expect(screen.getByText('16–30 of 31')).toBeDefined();
  });

  it('clips the last window to the total', () => {
    render(<Pager {...BASE} page={3} total={31} />);

    expect(screen.getByText('31–31 of 31')).toBeDefined();
  });

  it('never prints a range whose first exceeds its last on a page past the end', () => {
    render(<Pager {...BASE} page={99} total={16} />);

    expect(screen.queryByText(/^\d+–\d+ of/)).toBeNull();
    expect(screen.getByText('Past the last page')).toBeDefined();
    // Previous lands on the last page that has rows, not on page 98.
    expect(screen.getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe(
      '/admin/payments?flag=payout-failing&page=2',
    );
    expect(screen.getByRole('link', { name: 'Next' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('link', { name: 'Next' }).getAttribute('href')).toBeNull();
    expect(screen.queryByRole('link', { current: 'page' })).toBeNull();
  });

  it('renders nothing when everything fits on one page', () => {
    const { container } = render(<Pager {...BASE} page={1} total={15} />);

    expect(container.innerHTML).toBe('');
  });

  describe('with two filters set', () => {
    const FILTERED = {
      path: '/admin/vendors',
      params: { q: 'rose', status: 'active' },
      pageSize: 15,
      total: 208,
    };
    const at = (n: number): string => `/admin/vendors?q=rose&status=active&page=${n}`;

    it('page 1: Previous is disabled, Next and every number keep the filters', () => {
      render(<Pager {...FILTERED} page={1} />);

      const prev = screen.getByRole('link', { name: 'Previous' });
      expect(prev.getAttribute('aria-disabled')).toBe('true');
      expect(prev.getAttribute('href')).toBeNull();
      const next = screen.getByRole('link', { name: 'Next' });
      expect(next.getAttribute('href')).toBe(at(2));
      expect(next.getAttribute('aria-disabled')).toBeNull();
      expect(screen.getByRole('link', { name: '14' }).getAttribute('href')).toBe(at(14));
      expect(screen.getByText('1–15 of 208')).toBeDefined();
    });

    it('a middle page: both arrows live, the current number is aria-current, ellipses close the gaps', () => {
      render(<Pager {...FILTERED} page={7} />);

      expect(screen.getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe(at(6));
      expect(screen.getByRole('link', { name: 'Next' }).getAttribute('href')).toBe(at(8));
      const current = screen.getByRole('link', { current: 'page' });
      expect(current.textContent).toBe('7');
      expect(current.getAttribute('href')).toBe(at(7));
      const numbers = screen
        .getAllByRole('link')
        .map((l) => l.textContent)
        .filter((t) => /^\d+$/.test(t ?? ''));
      expect(numbers).toEqual(['1', '6', '7', '8', '14']);
      expect(screen.getAllByText('…')).toHaveLength(2);
      expect(screen.getByText('Page 7 of 14')).toBeDefined();
    });

    it('the last page: Next is disabled, Previous keeps the filters', () => {
      render(<Pager {...FILTERED} page={14} />);

      const next = screen.getByRole('link', { name: 'Next' });
      expect(next.getAttribute('aria-disabled')).toBe('true');
      expect(next.getAttribute('href')).toBeNull();
      expect(screen.getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe(at(13));
      expect(screen.getByText('196–208 of 208')).toBeDefined();
    });

    it('is a labelled nav that never wraps', () => {
      render(<Pager {...FILTERED} page={2} />);

      const nav = screen.getByRole('navigation', { name: 'Pagination' });
      expect(nav.className).toContain('whitespace-nowrap');
      expect(nav.className).toContain('h-[30px]');
    });
  });

  it('walks the key it is given, leaving the sibling table alone', () => {
    render(
      <Pager
        path="/admin/vendor-applications"
        params={{ page: '3' }}
        page={1}
        pageSize={15}
        total={40}
        pageParam="invitePage"
      />,
    );

    expect(screen.getByRole('link', { name: 'Next' }).getAttribute('href')).toBe(
      '/admin/vendor-applications?page=3&invitePage=2',
    );
  });
});

describe('OutOfRange', () => {
  it('says the page is past the end and links back to page 1 with the filters kept', () => {
    render(<OutOfRange {...BASE} page={2} total={15} />);

    expect(screen.getByText('Page 2 is past the end')).toBeDefined();
    expect(screen.getByText('15 rows match, on 1 page.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to page 1' }).getAttribute('href')).toBe(
      '/admin/payments?flag=payout-failing',
    );
  });
});
