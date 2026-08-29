import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@vendor-marketplace/shared';
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

/*
 * The path the middleware stamps on every request. It is the fallback the
 * layout-gated routes depend on, so it has to be steerable from a test.
 */
let requestPath: string | null = null;

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ getToken, userId }) }));
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => requestPath }),
}));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));
vi.mock('./api-client', async () => {
  const actual = await vi.importActual<typeof import('./api-client')>('./api-client');
  return { ...actual, apiRequest: (...args: unknown[]) => apiRequest(...args) };
});

const {
  DASHBOARD_PATH_BY_ROLE,
  getCurrentUser,
  readRoleForChrome,
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
    expect(DASHBOARD_PATH_BY_ROLE.admin).toBe('/');
  });

  /*
   * The role bounce redirects to this map, so a role whose entry is a route
   * that role is refused bounces forever. `/bookings` is gated by
   * `requireRole('customer')`, which is why `admin` cannot point at it — an
   * admin signing in from any protected route hit ERR_TOO_MANY_REDIRECTS.
   */
  it('never sends a role to a route that role is refused', () => {
    const GATED_BY: Record<string, UserRole> = {
      '/bookings': 'customer',
      '/vendor/dashboard': 'vendor',
    };

    for (const [role, path] of Object.entries(DASHBOARD_PATH_BY_ROLE)) {
      const gate = GATED_BY[path];
      expect(gate === undefined || gate === role).toBe(true);
    }
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

/*
 * `SiteHeader` renders in the root layout, so anything it throws escapes every
 * `error.tsx` and only `global-error.tsx` catches it — which replaces the whole
 * document. The vendor chip is decoration, so its read must never be able to
 * cost the page.
 */
describe('readRoleForChrome', () => {
  beforeEach(() => {
    getToken.mockReset();
    apiRequest.mockReset();
    redirect.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the role when the record reads', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(VENDOR);

    await expect(readRoleForChrome()).resolves.toBe('vendor');
  });

  it('returns null when nobody is signed in', async () => {
    getToken.mockResolvedValue(null);

    await expect(readRoleForChrome()).resolves.toBeNull();
  });

  /*
   * The suspended case, which is the one that would have been worst: the API
   * answers a banned account 403, and `/suspended` is where such an account is
   * sent — so a propagating read would have made the very page it is redirected
   * to unreachable, along with every other page in the product.
   */
  it('degrades on a 403 rather than taking the document down', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockRejectedValue(new ApiClientError(403, 'FORBIDDEN', 'Account suspended'));

    await expect(readRoleForChrome()).resolves.toBeNull();
  });

  it('degrades when the API is unreachable', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockRejectedValue(new Error('fetch failed'));

    await expect(readRoleForChrome()).resolves.toBeNull();
  });

  it('degrades on a 500 as well, where getCurrentUser propagates', async () => {
    getToken.mockResolvedValue('token');
    apiRequest.mockRejectedValue(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));

    await expect(readRoleForChrome()).resolves.toBeNull();
  });

  /*
   * A redirect is not a failure. Swallowing Next's navigation signal would turn
   * every redirect raised beneath this read into a silent no-op.
   */
  it('lets a navigation signal through', async () => {
    getToken.mockResolvedValue('token');

    const signal = new Error('NEXT_REDIRECT:/suspended') as Error & { digest: string };
    signal.digest = 'NEXT_REDIRECT;replace;/suspended;307;';
    apiRequest.mockRejectedValue(signal);

    await expect(readRoleForChrome()).rejects.toBe(signal);
  });
});

/**
 * #76 — signing in used to discard where the visitor was going, so a customer
 * who was half way through a booking landed on `/` with the booking gone.
 */
describe('the destination survives the sign-in round trip', () => {
  beforeEach(() => {
    getToken.mockReset();
    apiRequest.mockReset();
    redirect.mockClear();
    requestPath = null;
    getToken.mockResolvedValue(null);
  });

  /** The `/sign-in` URL the gate redirected to, or `null` if it did not. */
  async function signInTargetOf(call: Promise<unknown>): Promise<string | null> {
    await expect(call).rejects.toThrow(/NEXT_REDIRECT/);
    const target = redirect.mock.calls.at(-1)?.[0] ?? null;
    return target;
  }

  /*
   * The routes gated by a **layout**, which is the case the stamped header
   * exists for: `app/customer/layout.tsx` and `app/vendor/layout.tsx` render
   * above the page and are never told which child URL they are guarding, so
   * the header is the only thing they can go on. These rows are the ones that
   * genuinely exercise the fallback.
   */
  it.each([
    ['/customer/profile', '/customer/profile'],
    ['/customer/profile with a query', '/customer/profile?tab=reviews'],
    ['/vendor/packages', '/vendor/packages?filter=active'],
    ['/vendor/dashboard', '/vendor/dashboard'],
  ])('%s falls back to the stamped path', async (_route, path) => {
    requestPath = path;

    expect(await signInTargetOf(requireCurrentUser())).toBe(
      `/sign-in?returnTo=${encodeURIComponent(path)}`,
    );
  });

  /*
   * The routes that pass their own destination. These assert the argument is
   * honoured verbatim — the pages build these strings themselves, and the
   * stamped header is deliberately not consulted.
   */
  it.each([
    ['/bookings', '/bookings?tab=history'],
    ['/messages', '/messages?conversation=c1'],
    ['a booking request', '/vendors/june-harlow/request?package=p1&date=2026-09-01'],
  ])('%s carries the destination its page passed', async (_route, path) => {
    requestPath = '/somewhere-else';

    expect(await signInTargetOf(requireCurrentUser(path))).toBe(
      `/sign-in?returnTo=${encodeURIComponent(path)}`,
    );
  });

  /*
   * A page knows its own URL exactly — including which of its query values it
   * actually honoured — so what it passes beats what the request happened to
   * carry.
   */
  it('prefers the destination a caller passes over the stamped path', async () => {
    requestPath = '/bookings?tab=nonsense';

    expect(await signInTargetOf(requireCurrentUser('/bookings?tab=upcoming'))).toBe(
      `/sign-in?returnTo=${encodeURIComponent('/bookings?tab=upcoming')}`,
    );
  });

  /*
   * The open-redirect boundary, exercised through the gate rather than only
   * through the validator: a destination that names another origin is dropped,
   * and sign-in still happens.
   */
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/x/..//evil.example'])(
    'refuses to bounce to %s',
    async (hostile) => {
      requestPath = hostile;

      expect(await signInTargetOf(requireCurrentUser())).toBe('/sign-in');
    },
  );

  it('refuses a destination a caller passes that would leave the origin', async () => {
    expect(await signInTargetOf(requireCurrentUser('https://evil.example'))).toBe('/sign-in');
  });

  it('carries the destination through requireRole too', async () => {
    requestPath = '/vendor/packages';

    expect(await signInTargetOf(requireRole('vendor'))).toBe(
      `/sign-in?returnTo=${encodeURIComponent('/vendor/packages')}`,
    );
  });

  /*
   * Signing in does not make a customer entitled to a vendor route, so the role
   * bounce ignores the destination and sends them to their own home instead.
   */
  it('sends a customer on a vendor route to their own home, not back to it', async () => {
    requestPath = '/vendor/packages';
    getToken.mockResolvedValue('token');
    apiRequest.mockResolvedValue(CUSTOMER);

    expect(await signInTargetOf(requireRole('vendor'))).toBe('/bookings');
  });
});

/**
 * #76 — the other way into the sign-in page. Signing in in a second tab and
 * reloading the first took this branch, and dropping the destination here put
 * the visitor on their role's default start with their work lost.
 */
describe('redirectIfSignedIn', () => {
  beforeEach(() => {
    redirect.mockClear();
    requestPath = null;
    userId = 'clerk_123';
  });

  async function targetOf(call: Promise<unknown>): Promise<string> {
    await expect(call).rejects.toThrow(/NEXT_REDIRECT/);
    return redirect.mock.calls.at(-1)?.[0] as string;
  }

  it('forwards the destination it was given', async () => {
    expect(await targetOf(redirectIfSignedIn('/bookings?tab=history'))).toBe(
      `/after-sign-in?returnTo=${encodeURIComponent('/bookings?tab=history')}`,
    );
  });

  it('goes to the bare handler when there is no destination', async () => {
    expect(await targetOf(redirectIfSignedIn())).toBe('/after-sign-in');
  });

  it.each(['https://evil.example', '//evil.example', '/x/..//evil.example'])(
    'drops %s rather than forwarding it',
    async (hostile) => {
      expect(await targetOf(redirectIfSignedIn(hostile))).toBe('/after-sign-in');
    },
  );

  it('does nothing at all when nobody is signed in', async () => {
    userId = null;

    await expect(redirectIfSignedIn('/bookings')).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
