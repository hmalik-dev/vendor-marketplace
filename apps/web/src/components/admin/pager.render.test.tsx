import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OutOfRange } from './out-of-range';
import { Pager } from './pager';

afterEach(cleanup);

const BASE = { path: '/admin/payments', params: { flag: 'payout-failing' }, pageSize: 15 };

describe('Pager', () => {
  it('states the window on a page that has rows', () => {
    render(<Pager {...BASE} page={2} total={31} />);

    expect(screen.getByText('16–30')).toBeDefined();
  });

  it('clips the last window to the total', () => {
    render(<Pager {...BASE} page={3} total={31} />);

    expect(screen.getByText('31–31')).toBeDefined();
  });

  it('never prints a range whose first exceeds its last on a page past the end', () => {
    render(<Pager {...BASE} page={99} total={16} />);

    expect(screen.queryByText(/^\d+–\d+$/)).toBeNull();
    expect(screen.getByText('Past the last page')).toBeDefined();
    // Previous lands on the last page that has rows, not on page 98.
    expect(screen.getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe(
      '/admin/payments?flag=payout-failing&page=2',
    );
    expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
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
