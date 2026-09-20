import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SearchError from './search/error';
import VendorError from './vendors/[slug]/error';
import BookingError from './bookings/[requestId]/error';
import SupportError from './support/error';

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

const APP_DIR = join(process.cwd(), 'src/app');

const NO_PAYMENT_CLAIM = 'No payment was taken';

/*
 * VEN-476: a failed read on these routes fell to the root boundary by accident;
 * each now owns a boundary file.
 *
 * Two routes deliberately have no `loading.tsx`. `/vendors/[slug]` and
 * `/bookings/[requestId]` call `notFound()`, and `/search` answers a retired
 * category with `permanentRedirect()`; a loading boundary above either streams
 * a 200 shell and turns the 404 / 308 into a status the browser and crawlers
 * never see (`loading-boundaries.test.ts`).
 */
const ERROR_BOUNDARIES = [
  ['search', SearchError],
  ['vendors/[slug]', VendorError],
  ['bookings/[requestId]', BookingError],
  ['support', SupportError],
] as const;

describe('segment error boundaries', () => {
  afterEach(cleanup);

  it.each(ERROR_BOUNDARIES)(
    '%s renders the error screen with a working retry and the brand from its source',
    async (_segment, Boundary) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const reset = vi.fn();
      const error = Object.assign(new Error('upstream exploded'), { digest: 'err_9F3K2QX7' });

      const { container } = render(<Boundary error={error} reset={reset} />);

      expect(screen.getByText('err_9F3K2QX7')).toBeTruthy();
      // No stack trace or raw upstream message reaches the page.
      expect(container.textContent).not.toContain('upstream exploded');
      // The wordmark is drawn from BRAND_NAME, so a rebrand needs no edit here.
      expect(screen.getAllByLabelText(BRAND_NAME).length).toBeGreaterThan(0);

      await userEvent.click(screen.getByRole('button', { name: /try again/i }));

      expect(reset).toHaveBeenCalledTimes(1);
    },
  );

  it('does not tell a customer on a booking that no payment was taken', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(<BookingError error={new Error('boom')} reset={vi.fn()} />);

    expect(container.textContent).not.toContain(NO_PAYMENT_CLAIM);
  });

  it('keeps the no-payment reassurance where nothing can have been charged', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(<SearchError error={new Error('boom')} reset={vi.fn()} />);

    expect(container.textContent).toContain(NO_PAYMENT_CLAIM);
  });

  it('streams the page loader on support', () => {
    expect(readFileSync(join(APP_DIR, 'support/loading.tsx'), 'utf8')).toContain(
      'PageLoader as default',
    );
  });

  it.each(['search', 'vendors/[slug]', 'bookings/[requestId]'])(
    '%s has no loading boundary, so its 404 or 308 stays a real status',
    (segment) => {
      expect(existsSync(join(APP_DIR, segment, 'loading.tsx'))).toBe(false);
    },
  );
});
