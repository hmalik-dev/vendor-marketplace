import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
vi.mock('@vercel/analytics/next', () => ({
  Analytics: ({ beforeSend }: { beforeSend?: unknown }) => (
    <div
      data-testid="vercel-analytics"
      data-before-send={String(beforeSend === scrubAnalyticsEvent)}
    />
  ),
}));

import { scrubAnalyticsEvent } from './analytics-scrub';
import { WebAnalytics } from './web-analytics';

describe('WebAnalytics', () => {
  beforeEach(() => {
    navigation.pathname = '/';
  });

  it.each(['/', '/vendors/kessler-co', '/bookings/8f2c1e64/checkout', '/administrators'])(
    'reports page views on %s',
    (pathname) => {
      navigation.pathname = pathname;
      const { queryByTestId } = render(<WebAnalytics />);

      expect(queryByTestId('vercel-analytics')?.getAttribute('data-before-send')).toBe('true');
    },
  );

  it.each(['/admin', '/admin/users/8f2c1e64'])(
    'renders nothing on the console at %s',
    (pathname) => {
      navigation.pathname = pathname;
      const { container } = render(<WebAnalytics />);

      expect(container.innerHTML).toBe('');
    },
  );
});
