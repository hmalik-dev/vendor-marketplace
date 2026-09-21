import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * VEN-532 — every admin page reads through `admin-data`, so the role check
 * there is what guards a page rendered without its layout. `current-user` is
 * the real module: the bounce destinations are its, not this test's.
 */

let role: string | null = null;
const apiRequest = vi.fn();

vi.mock('./auth/server', () => ({
  getServerSession: async () => (role ? { userId: 'user-1', token: 'tok' } : null),
}));

vi.mock('@sentry/nextjs', () => ({
  getIsolationScope: () => ({ setUser: vi.fn() }),
}));

vi.mock('./requested-path', () => ({
  requestedPath: async () => '/admin/tags',
  signInPathReturningHere: async () => '/sign-in?returnTo=%2Fadmin%2Ftags',
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
}));

vi.mock('./api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api-client')>()),
  apiRequest: (path: string, options: unknown) => apiRequest(path, options),
}));

const { getAdminTags } = await import('./admin-data');

beforeEach(() => {
  role = null;
  apiRequest.mockReset();
  apiRequest.mockImplementation(async (path: string) =>
    path === '/users/me' ? { id: 'user-1', role } : { tags: [] },
  );
});

/** The admin API reads made, `/users/me` being the caller's own record. */
function adminCalls(): string[] {
  return apiRequest.mock.calls.map((call) => call[0] as string).filter((p) => p !== '/users/me');
}

describe('admin reads', () => {
  it.each([
    ['customer', '/bookings'],
    ['vendor', '/vendor/dashboard'],
  ])('bounce a %s to their own home before any admin request', async (who, home) => {
    role = who;

    await expect(getAdminTags()).rejects.toThrow(`NEXT_REDIRECT:${home}`);
    expect(adminCalls()).toEqual([]);
  });

  it('send a signed-out caller to sign-in before any admin request', async () => {
    await expect(getAdminTags()).rejects.toThrow('NEXT_REDIRECT:/sign-in?returnTo=%2Fadmin%2Ftags');
    expect(adminCalls()).toEqual([]);
  });

  it('read once the caller is an admin', async () => {
    role = 'admin';

    await getAdminTags();

    expect(adminCalls()).toEqual(['/admin/tags']);
  });
});
