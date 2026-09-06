import { PUBLISH_BLOCKER_KEYS } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PublishBlockerBanner } from './publish-blocker-banner';

/*
 * The gold banner frames `20` and `27 Vendor dashboard — empty · 1024` draw and
 * the app had no counterpart for (#371).
 *
 * What this guards is the thing D30 ruled: the banner names what the *gate* is
 * holding. A banner built from a parallel setup list would still render, still
 * look right, and tell a vendor they are two steps from live when the gate has
 * three — which is the failure `publish-checklist.tsx` says in its own comment
 * is worse than having no checklist at all.
 */
describe('PublishBlockerBanner', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing once the gate is clear', () => {
    const { container } = render(<PublishBlockerBanner blockers={[]} />);

    expect(container.innerHTML).toBe('');
  });

  it('counts the open blockers in the singular', () => {
    render(<PublishBlockerBanner blockers={['responseTime']} />);

    expect(screen.getByText(/1 thing left/)).toBeTruthy();
    expect(screen.queryByText(/things left/)).toBeNull();
  });

  it('names every open blocker, and only the open ones', () => {
    render(<PublishBlockerBanner blockers={['responseTime', 'packages']} />);

    expect(screen.getByText(/2 things left/)).toBeTruthy();
    expect(
      screen.getByText('Say how quickly you usually reply · Publish at least one service package'),
    ).toBeTruthy();
    expect(screen.queryByText(/business name/i)).toBeNull();
  });

  it('is gold, because nothing has failed', () => {
    render(<PublishBlockerBanner blockers={['bio']} />);

    expect(screen.getByRole('status').getAttribute('data-status')).toBe('pending');
  });

  it('offers one control, and it goes to the editor that fixes the blockers', () => {
    render(<PublishBlockerBanner blockers={['bio']} />);

    expect(screen.getByRole('link', { name: 'Finish profile' }).getAttribute('href')).toBe(
      '/vendor/profile/edit',
    );
  });

  /*
   * Payouts are not a publish blocker (#360, restated in D30), so the banner
   * cannot be asked to name them — there is no key for it to render.
   */
  it('can only ever name a real gate key', () => {
    render(<PublishBlockerBanner blockers={PUBLISH_BLOCKER_KEYS} />);

    expect(screen.getByText(/6 things left/)).toBeTruthy();
    expect(screen.queryByText(/payout/i)).toBeNull();
  });
});
