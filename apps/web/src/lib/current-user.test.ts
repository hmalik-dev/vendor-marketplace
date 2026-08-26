import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from './api-client';

const getToken = vi.fn<() => Promise<string | null>>();
const apiRequest = vi.fn();
const redirect = vi.fn((path: string) => {
  // Next's redirect() never returns; throwing keeps callers from running on.
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ getToken }) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));
vi.mock('./api-client', async () => {
  const actual = await vi.importActual<typeof import('./api-client')>('./api-client');
  return { ...actual, apiRequest: (...args: unknown[]) => apiRequest(...args) };
});

const { DASHBOARD_PATH_BY_ROLE, getCurrentUser, requireCurrentUser, requireRole } =
  await import('./current-user');

const CUSTOMER = { id: 'u1', firstName: 'Ada', role: 'customer' as const };
const VENDOR = { id: 'u2', firstName: 'Grace', role: 'vendor' as const };

describe('DASHBOARD_PATH_BY_ROLE', () => {
  it('routes each role to its own dashboard', () => {
    expect(DASHBOARD_PATH_BY_ROLE.customer).toBe('/customer/dashboard');
    expect(DASHBOARD_PATH_BY_ROLE.vendor).toBe('/vendor/dashboard');
  });

  it('covers every role so the lookup can never return undefined', () => {
    expect(DASHBOARD_PATH_BY_ROLE.admin).toBe('/customer/dashboard');
  });
});

describe('getCurrentUser', () => {
  beforeEach(() => {
    getToken.mockReset();
    apiRequest.mockReset();
    redirect.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when there is no Clerk session', async () => {
    getToken.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('returns the profile the API resolved for the session', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(CUSTOMER);

    await expect(getCurrentUser()).resolves.toEqual(CUSTOMER);
  });

  it('treats a rejected session as signed out rather than an error', async () => {
    getToken.mockResolvedValue('stale-token');
    apiRequest.mockRejectedValue(new ApiClientError(401, 'UNAUTHORIZED', 'Session is invalid'));

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('propagates a genuine API failure instead of hiding it as signed out', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockRejectedValue(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));

    await expect(getCurrentUser()).rejects.toBeInstanceOf(ApiClientError);
  });
});

describe('requireCurrentUser', () => {
  beforeEach(() => {
    getToken.mockReset();
    apiRequest.mockReset();
    redirect.mockClear();
  });

  it('sends a signed-out visitor to sign-in', async () => {
    getToken.mockResolvedValue(null);

    await expect(requireCurrentUser()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(redirect).toHaveBeenCalledWith('/sign-in');
  });

  it('returns the user when the session resolves', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(VENDOR);

    await expect(requireCurrentUser()).resolves.toEqual(VENDOR);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends a suspended account to its own page instead of crashing the render', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockRejectedValue(
      new ApiClientError(403, 'FORBIDDEN', 'This account has been suspended'),
    );

    await expect(requireCurrentUser()).rejects.toThrow('NEXT_REDIRECT:/suspended');
    expect(redirect).toHaveBeenCalledWith('/suspended');
  });

  it('still surfaces an unexpected API failure rather than swallowing it', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockRejectedValue(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));

    await expect(requireCurrentUser()).rejects.toBeInstanceOf(ApiClientError);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  beforeEach(() => {
    getToken.mockReset();
    apiRequest.mockReset();
    redirect.mockClear();
  });

  it('admits a user holding the required role', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(VENDOR);

    await expect(requireRole('vendor')).resolves.toEqual(VENDOR);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('bounces a customer out of a vendor route to their own dashboard', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(CUSTOMER);

    await expect(requireRole('vendor')).rejects.toThrow('NEXT_REDIRECT:/customer/dashboard');
    expect(redirect).toHaveBeenCalledWith('/customer/dashboard');
  });

  it('bounces a vendor out of a customer route to their own dashboard', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(VENDOR);

    await expect(requireRole('customer')).rejects.toThrow('NEXT_REDIRECT:/vendor/dashboard');
    expect(redirect).toHaveBeenCalledWith('/vendor/dashboard');
  });
});
