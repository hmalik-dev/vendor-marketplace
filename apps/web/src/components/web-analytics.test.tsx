import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
vi.mock('@vercel/analytics/next', () => ({
  Analytics: () => <div data-testid="vercel-analytics" />,
}));

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

      expect(queryByTestId('vercel-analytics')).not.toBeNull();
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
