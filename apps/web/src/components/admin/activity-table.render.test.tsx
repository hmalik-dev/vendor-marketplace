import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ActivityTable } from './activity-table';
import type { WireAdminActivityRow } from '@/lib/wire-schemas';

afterEach(cleanup);

const BASE: WireAdminActivityRow = {
  id: '11111111-1111-4111-8111-111111111111',
  actorId: '22222222-2222-4222-8222-222222222222',
  actorName: 'Dana Okafor',
  action: 'user_banned',
  subjectType: 'user',
  subjectId: '33333333-3333-4333-8333-333333333333',
  detail: {},
  createdAt: new Date('2026-09-07T11:31:00.000Z'),
};

const row = (overrides: Partial<WireAdminActivityRow>): WireAdminActivityRow => ({
  ...BASE,
  ...overrides,
});

describe('the action log table', () => {
  /**
   * The rule that was wrong once: **`false` prints, `null` drops.**
   *
   * `false` used to be filtered out alongside `null`, which hid the entire
   * content of some rows — a tag deactivation records `isActive false` and
   * nothing else, so it rendered as an em dash and said nothing at all. It also
   * made a ban that unpublished a storefront indistinguishable from one that
   * did not, while `0` printed throughout.
   */
  it('prints a false value rather than hiding it', () => {
    render(
      <ActivityTable
        path="/admin/activity"
        filtered={false}
        rows={[row({ action: 'tag_updated', subjectType: 'tag', detail: { isActive: false } })]}
      />,
    );

    expect(screen.getAllByText(/isActive false/).length).toBeGreaterThan(0);
  });

  it('prints a zero, which is the count that most needs saying', () => {
    render(
      <ActivityTable
        path="/admin/activity"
        filtered={false}
        rows={[row({ detail: { refundsIssued: 0, refundsFailed: 0 } })]}
      />,
    );

    expect(screen.getAllByText(/refundsIssued 0 · refundsFailed 0/).length).toBeGreaterThan(0);
  });

  /* `null` means "not applicable here" rather than "no", so it is dropped. */
  it('drops a null value and keeps the rest of the line', () => {
    render(
      <ActivityTable
        path="/admin/activity"
        filtered={false}
        rows={[
          row({
            action: 'dispute_resolved',
            subjectType: 'booking',
            detail: { outcome: 'vendor', refundAmountCents: null },
          }),
        ]}
      />,
    );

    expect(screen.getAllByText('outcome vendor').length).toBeGreaterThan(0);
  });

  it('renders an em dash where a row genuinely recorded no detail', () => {
    render(<ActivityTable path="/admin/activity" filtered={false} rows={[row({ detail: {} })]} />);

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  /**
   * The timestamp carries its year and its zone.
   *
   * Without the year two rows twelve months apart read identically, on the one
   * screen whose value is "who did what and when"; without the zone a
   * timestamp quoted into a support thread is off by the reader's offset.
   */
  it('stamps the year and the zone, not only the day and the time', () => {
    render(<ActivityTable path="/admin/activity" filtered={false} rows={[row({})]} />);

    const stamps = screen.getAllByText(/Sep 7, 2026/);
    expect(stamps.length).toBeGreaterThan(0);
    expect(stamps[0]?.textContent).toContain('UTC');
  });

  /** Both id cells filter by themselves — that is how `?subject=` is reachable. */
  it('links each row to the operator and the subject it names', () => {
    render(<ActivityTable path="/admin/activity" filtered={false} rows={[row({})]} />);

    const actor = screen.getAllByRole('link', { name: 'Dana Okafor' })[0];
    expect(actor?.getAttribute('href')).toBe(
      '/admin/activity?actor=22222222-2222-4222-8222-222222222222',
    );

    const subject = screen.getAllByRole('link', { name: /Account 33333333/ })[0];
    expect(subject?.getAttribute('href')).toBe(
      '/admin/activity?subject=33333333-3333-4333-8333-333333333333',
    );
  });

  it('says the action in words rather than printing the enum member', () => {
    render(<ActivityTable path="/admin/activity" filtered={false} rows={[row({})]} />);

    expect(screen.getAllByText('Suspended an account').length).toBeGreaterThan(0);
    expect(screen.queryByText('user_banned')).toBeNull();
  });

  it('tells an empty log apart from a filter that matched nothing', () => {
    const { unmount } = render(<ActivityTable path="/admin/activity" filtered={false} rows={[]} />);
    expect(screen.getByText('No console activity yet')).toBeDefined();
    unmount();

    render(<ActivityTable path="/admin/activity" filtered rows={[]} />);
    expect(screen.getByText('Nothing matches that filter')).toBeDefined();
  });
});
