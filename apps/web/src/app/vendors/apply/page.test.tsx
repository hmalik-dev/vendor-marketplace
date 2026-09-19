import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const identity = vi.hoisted(() => ({
  user: null as { role: string } | null,
  email: null as string | null,
}));
const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);

/*
 * The real `readIdentityForSupport` swallows every refusal, which is the point:
 * the session the vendor gate sends here is answered `TERMS_REQUIRED` by
 * `/users/me`, and the suspension-redirecting reader turned that into
 * `/suspended`. The page must take the swallowing reader, so it is the one
 * mocked; a page that imported the other would find it undefined and fail.
 */
vi.mock('@/lib/current-user', () => ({
  readIdentityForSupport: async () => identity.user,
}));
vi.mock('@/lib/auth/server', () => ({
  neonAuth: () => ({
    getSession: async () => ({
      data: identity.email === null ? null : { user: { id: 'u1', email: identity.email } },
    }),
  }),
}));
vi.mock('@/components/auth/sign-out-button', () => ({
  SignOutButton: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/components/vendors/vendor-application-form', () => ({
  VendorApplicationForm: ({ sessionEmail }: { sessionEmail: string | null }) => (
    <p>form for {sessionEmail ?? 'a visitor'}</p>
  ),
}));

const { default: VendorApplyPage } = await import('./page');

afterEach(() => {
  cleanup();
  identity.user = null;
  identity.email = null;
  redirect.mockClear();
});

describe('/vendors/apply', () => {
  it('renders the form for a session the vendor gate refused, saying no account was created', async () => {
    identity.email = 'refused@example.com';

    render(await VendorApplyPage());

    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByText('form for refused@example.com')).toBeDefined();
    expect(screen.getByText(/No account was created for refused@example\.com\./)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined();
  });

  it('renders the form for a signed-out visitor, with no sign-out', async () => {
    render(await VendorApplyPage());

    expect(screen.getByText('form for a visitor')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('tells a customer who already has an account so, with no form and no false sentence', async () => {
    identity.user = { role: 'customer' };
    identity.email = 'customer@example.com';

    render(await VendorApplyPage());

    expect(screen.getByRole('heading', { name: 'You already have an account' })).toBeDefined();
    expect(screen.queryByText(/form for/)).toBeNull();
    expect(screen.queryByText(/No account was created/)).toBeNull();
    expect(screen.getByRole('button', { name: /Sign out/ })).toBeDefined();
  });

  it('sends a vendor who already has an account to their dashboard', async () => {
    identity.user = { role: 'vendor' };

    await expect(VendorApplyPage()).rejects.toThrow('NEXT_REDIRECT:/vendor/dashboard');
  });
});
