import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = { userId: null as string | null };
const setUser = vi.fn();

vi.mock('@clerk/nextjs', () => ({ useAuth: () => auth }));
vi.mock('@sentry/nextjs', () => ({ setUser: (user: unknown) => setUser(user) }));

const { ErrorReportingUser } = await import('./error-reporting-user');

describe('ErrorReportingUser', () => {
  beforeEach(() => {
    setUser.mockReset();
    auth.userId = null;
  });

  it('attaches only the Clerk user id, and clears it on sign-out', () => {
    auth.userId = 'user_2abc';
    const view = render(<ErrorReportingUser />);

    expect(setUser.mock.calls).toEqual([[{ id: 'user_2abc' }]]);

    auth.userId = null;
    view.rerender(<ErrorReportingUser />);

    expect(setUser.mock.calls).toEqual([[{ id: 'user_2abc' }], [null]]);
  });
});
