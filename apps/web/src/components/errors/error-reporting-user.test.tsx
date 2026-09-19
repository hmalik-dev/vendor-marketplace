import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setUser = vi.fn();

vi.mock('@sentry/nextjs', () => ({ setUser: (user: unknown) => setUser(user) }));

const { ErrorReportingUser } = await import('./error-reporting-user');

describe('ErrorReportingUser', () => {
  beforeEach(() => {
    setUser.mockReset();
  });

  it('attaches only the user id, and clears it on sign-out', () => {
    const view = render(<ErrorReportingUser userId="user_2abc" />);

    expect(setUser.mock.calls).toEqual([[{ id: 'user_2abc' }]]);

    view.rerender(<ErrorReportingUser userId={null} />);

    expect(setUser.mock.calls).toEqual([[{ id: 'user_2abc' }], [null]]);
  });
});
