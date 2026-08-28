import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from './api-client';

const getToken = vi.fn<() => Promise<string | null>>();
let userId: string | null = null;
const apiRequest = vi.fn();
const redirect = vi.fn((path: string) => {
  /*
   * Next's redirect() never returns; throwing keeps callers from running on.
   * The `digest` matters: that is how Next marks a navigation throw, and the
   * public-route degrade keys on it to let redirects through while swallowing
   * real failures. Without it here the tests would not exercise that branch.
   */
  const signal = new Error(`NEXT_REDIRECT:${path}`) as Error & { digest: string };
  signal.digest = `NEXT_REDIRECT;replace;${path};307;`;
  throw signal;
});

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ getToken, userId }) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));
vi.mock('./api-client', async () => {
  const actual = await vi.importActual<typeof import('./api-client')>('./api-client');
  return { ...actual, apiRequest: (...args: unknown[]) => apiRequest(...args) };
});

const {
  DASHBOARD_PATH_BY_ROLE,
  getCurrentUser,
  redirectIfSignedIn,
  POST_SIGN_IN_PATH_BY_ROLE,
  redirectVendorToDashboard,
  requireCurrentUser,
  requireRole,
} = await import('./current-user');

const CUSTOMER = { id: 'u1', firstName: 'Ada', role: 'customer' as const };
const VENDOR = { id: 'u2', firstName: 'Grace', role: 'vendor' as const };

describe('DASHBOARD_PATH_BY_ROLE', () => {
  /*
   * A customer has no dashboard and never did — their home is the list of
   * bookings they have made, which is what #22b put at `/bookings` in place of
   * the placeholder that used to sit under `/customer`.
   */
  it('sends a customer to their bookings and a vendor to their dashboard', () => {
    expect(DASHBOARD_PATH_BY_ROLE.customer).toBe('/bookings');
    expect(DASHBOARD_PATH_BY_ROLE.vendor).toBe('/vendor/dashboard');
  });

  it('covers every role so the lookup can never return undefined', () => {
    expect(DASHBOARD_PATH_BY_ROLE.admin).toBe('/bookings');
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

  it('bounces a customer out of a vendor route to their own bookings', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(CUSTOMER);

    await expect(requireRole('vendor')).rejects.toThrow('NEXT_REDIRECT:/bookings');
    expect(redirect).toHaveBeenCalledWith('/bookings');
  });

  it('bounces a vendor out of a customer route to their own dashboard', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(VENDOR);

    await expect(requireRole('customer')).rejects.toThrow('NEXT_REDIRECT:/vendor/dashboard');
    expect(redirect).toHaveBeenCalledWith('/vendor/dashboard');
  });
});

describe('redirectIfSignedIn', () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  afterEach(() => {
    userId = null;
    vi.clearAllMocks();
  });

  it('lets a signed-out visitor stay on the authentication page', async () => {
    userId = null;

    await expect(redirectIfSignedIn()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends an already-signed-in visitor to the role-resolving landing route', async () => {
    userId = 'user_123';

    await expect(redirectIfSignedIn()).rejects.toThrow('NEXT_REDIRECT:/after-sign-in');
    expect(redirect).toHaveBeenCalledWith('/after-sign-in');
  });
});

describe('redirectVendorToDashboard', () => {
  beforeEach(() => {
    getToken.mockReset();
    apiRequest.mockReset();
    redirect.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('leaves a signed-out visitor on the landing page', async () => {
    getToken.mockResolvedValue(null);

    await expect(redirectVendorToDashboard()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('leaves a customer on the landing page, which is the browse surface', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(CUSTOMER);

    await expect(redirectVendorToDashboard()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends a vendor to the vendor dashboard instead', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(VENDOR);

    await expect(redirectVendorToDashboard()).rejects.toThrow('NEXT_REDIRECT:/vendor/dashboard');
    expect(redirect).toHaveBeenCalledWith('/vendor/dashboard');
  });

  it('sends a suspended account to the suspended page rather than a 500', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockRejectedValue(
      new ApiClientError(403, 'FORBIDDEN', 'This account has been suspended'),
    );

    await expect(redirectVendorToDashboard()).rejects.toThrow('NEXT_REDIRECT:/suspended');
    expect(redirect).toHaveBeenCalledWith('/suspended');
  });

  /*
   * `/` is public. With the API unreachable the identity read buys only the
   * convenience redirect, so it is skipped and the visitor gets the
   * marketplace with signed-out chrome — rather than the 500 boundary a
   * signed-in visitor used to get while signed-out ones saw the page.
   */
  it.each([
    ['an unreachable API', new Error('fetch failed')],
    ['a 500 from the API', new ApiClientError(500, 'INTERNAL_ERROR', 'Something went wrong')],
  ])('renders the public page through %s, skipping the redirect', async (_label, failure) => {
    getToken.mockResolvedValue('token');
    apiRequest.mockRejectedValue(failure);

    await expect(redirectVendorToDashboard()).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});

/*
 * The other half of the same decision, and the one that must not be "fixed".
 * A protected route that cannot resolve identity must not render: the role gate
 * and the suspension gate both hang off this read, so degrading it here would
 * fail open. If someone later wraps this in the public-route catch, these fail.
 */
describe('protected routes never degrade', () => {
  beforeEach(() => {
    getToken.mockReset();
    apiRequest.mockReset();
    redirect.mockClear();
  });

  it.each([
    ['an unreachable API', new Error('fetch failed')],
    ['a 500 from the API', new ApiClientError(500, 'INTERNAL_ERROR', 'Something went wrong')],
  ])('propagates %s rather than rendering', async (_label, failure) => {
    getToken.mockResolvedValue('token');
    apiRequest.mockRejectedValue(failure);

    await expect(requireCurrentUser()).rejects.toThrow();
    // Not a redirect to sign-in either: an outage is not a signed-out session.
    expect(redirect).not.toHaveBeenCalled();
  });

  it('keeps the suspension gate closed when the read fails', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockRejectedValue(new Error('fetch failed'));

    // A suspended user must not reach protected content because a read broke.
    await expect(requireRole('vendor')).rejects.toThrow();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('POST_SIGN_IN_PATH_BY_ROLE', () => {
  it('starts a vendor on their own dashboard', () => {
    expect(POST_SIGN_IN_PATH_BY_ROLE.vendor).toBe(DASHBOARD_PATH_BY_ROLE.vendor);
  });

  it('starts a customer on the marketplace home, not a dashboard', () => {
    // Browsing vendors is the customer's first move; the dashboard is not.
    expect(POST_SIGN_IN_PATH_BY_ROLE.customer).toBe('/');
    expect(POST_SIGN_IN_PATH_BY_ROLE.customer).not.toBe(DASHBOARD_PATH_BY_ROLE.customer);
  });

  it('covers every role so the lookup can never return undefined', () => {
    expect(POST_SIGN_IN_PATH_BY_ROLE.admin).toBe('/');
  });
});
