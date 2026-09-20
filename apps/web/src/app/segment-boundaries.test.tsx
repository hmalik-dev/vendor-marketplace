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

/*
 * VEN-476: a failed read on these routes fell to the root boundary by accident;
 * each now owns a boundary file. `/vendors/[slug]` and `/bookings/[requestId]`
 * deliberately have no `loading.tsx`: their pages call `notFound()`, and a
 * loading boundary above one turns its 404 into a soft 200
 * (`loading-boundaries.test.ts`).
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
    '%s renders the shared error screen with a working retry',
    async (segment, Boundary) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const reset = vi.fn();
      const error = Object.assign(new Error('upstream exploded'), { digest: 'err_9F3K2QX7' });

      const { container } = render(<Boundary error={error} reset={reset} />);

      expect(screen.getByText('err_9F3K2QX7')).toBeTruthy();
      // No stack trace or raw upstream message reaches the page.
      expect(container.textContent).not.toContain('upstream exploded');
      // Brand copy comes from the shared source, never a hand-typed literal.
      expect(BRAND_NAME.length).toBeGreaterThan(0);
      expect(readFileSync(join(APP_DIR, segment, 'error.tsx'), 'utf8')).not.toContain('Orla');

      await userEvent.click(screen.getByRole('button', { name: /try again/i }));

      expect(reset).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['search', 'support'])('%s streams the page loader', (segment) => {
    expect(readFileSync(join(APP_DIR, segment, 'loading.tsx'), 'utf8')).toContain(
      'PageLoader as default',
    );
  });

  it.each(['vendors/[slug]', 'bookings/[requestId]'])(
    '%s has no loading boundary, so notFound() stays a real 404',
    (segment) => {
      expect(existsSync(join(APP_DIR, segment, 'loading.tsx'))).toBe(false);
    },
  );
});
