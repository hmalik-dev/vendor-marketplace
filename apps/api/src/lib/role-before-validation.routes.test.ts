import { REPORT_RATE_LIMIT } from '@vendor-marketplace/shared';
import type { RouteOptions } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../testing/test-server.js';

/**
 * Fastify validates a request schema before `preHandler`, so a role guard
 * registered there answers a caller who has not proved their role with a 400
 * that describes the schema. Every role-gated route with a body schema must
 * guard in `onRequest` instead (`requireRoleBeforeValidation`).
 *
 * The body is `[]`: no object schema accepts it, so a route that validated
 * first would answer 400 to all three callers. Routes with no body schema are
 * malformed another way: a JSON content type with an empty body (the parser's
 * own 400), a non-uuid param, or an out-of-range query string.
 */
const ID = '11111111-1111-4111-8111-111111111111';

interface GuardedRoute {
  readonly method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'GET';
  readonly url: string;
  /** `any`: signed in is all the route asks, so there is no wrong role to refuse. */
  readonly role: 'vendor' | 'customer' | 'any';
  /** Sent as the JSON body. Omitted: `[]`. `''`: an empty JSON body. `undefined`: no body. */
  readonly payload?: unknown;
  /** False when the right role's 400 is the parser's, which carries no schema details. */
  readonly schemaDetails?: false;
}

/** Routes that ask only for a session; each is malformed by its param, query or body. */
const ANY_ROLE_ROUTES: readonly GuardedRoute[] = (
  [
    ['GET', '/customers/not-a-uuid/profile'],
    ['GET', `/customers/${ID}/reviews?page=0&pageSize=abc`],
    ['POST', '/customer/booking-requests/not-a-uuid/checkout'],
    ['GET', '/customer/booking-requests/not-a-uuid/booking'],
    ['GET', '/customer/bookings/not-a-uuid'],
    ['PUT', '/vendor/bookings/not-a-uuid/complete'],
    ['PUT', '/customer/bookings/not-a-uuid/cancel', []],
    ['GET', '/booking-requests?status=zz'],
    ['GET', '/booking-requests/not-a-uuid'],
    ['POST', '/booking-requests/not-a-uuid/accept'],
    ['POST', '/booking-requests/not-a-uuid/decline'],
    ['POST', '/booking-requests/not-a-uuid/cancel'],
    ['GET', '/bookings?page=0&pageSize=abc'],
    ['GET', '/conversations/not-a-uuid/messages'],
    ['POST', '/conversations/not-a-uuid/messages', []],
    ['PUT', '/conversations/not-a-uuid/read'],
    ['GET', '/notifications?page=0&pageSize=abc'],
    ['PUT', '/notifications/not-a-uuid/read'],
    ['POST', '/bookings/not-a-uuid/reviews', []],
    ['POST', '/reports', []],
    ['PUT', '/users/me', []],
  ] as const
).map(([method, url, ...body]) => ({
  method,
  url,
  role: 'any' as const,
  payload: body[0],
}));

const ROUTES: readonly GuardedRoute[] = [
  { method: 'POST', url: '/vendor/profile', role: 'vendor' },
  { method: 'PUT', url: '/vendor/profile', role: 'vendor' },
  { method: 'POST', url: '/vendor/packages', role: 'vendor' },
  { method: 'PUT', url: '/vendor/packages/reorder', role: 'vendor' },
  { method: 'PUT', url: `/vendor/packages/${ID}`, role: 'vendor' },
  { method: 'POST', url: '/vendor/portfolio', role: 'vendor' },
  { method: 'PUT', url: '/vendor/portfolio/reorder', role: 'vendor' },
  { method: 'PATCH', url: `/vendor/portfolio/${ID}`, role: 'vendor' },
  { method: 'PUT', url: '/vendor/availability', role: 'vendor' },
  { method: 'POST', url: '/tags/suggest', role: 'vendor' },
  { method: 'POST', url: `/booking-requests/${ID}/quote`, role: 'vendor' },
  { method: 'POST', url: '/booking-requests', role: 'customer' },
  { method: 'POST', url: '/conversations', role: 'customer' },
  { method: 'DELETE', url: '/vendor/portfolio/not-a-uuid', role: 'vendor', payload: undefined },
  {
    method: 'DELETE',
    url: `/vendor/portfolio/${ID}`,
    role: 'vendor',
    payload: '',
    schemaDetails: false,
  },
  {
    method: 'GET',
    url: '/customers/me/reviews?page=0&pageSize=abc',
    role: 'customer',
    payload: undefined,
  },
];

describe('role guards run before body validation', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();

    for (const [id, role] of [
      ['vendor_a', 'vendor'],
      ['customer_a', 'customer'],
    ] as const) {
      harness.authUsers.set(id, {
        authUserId: id,
        email: `${id}@example.com`,
        firstName: 'June',
        lastName: 'Harlow',
        roleHint: role,
        avatarUrl: null,
      });
    }
  });

  afterAll(async () => {
    await harness.close();
  });

  function send(route: GuardedRoute, user?: string) {
    return harness.app.inject({
      method: route.method,
      url: route.url,
      headers: {
        ...(route.payload === undefined && 'payload' in route
          ? {}
          : { 'content-type': 'application/json' }),
        ...(user ? bearer(user) : {}),
      },
      ...('payload' in route ? { payload: route.payload as string } : { payload: [] }),
    });
  }

  describe.each(ROUTES)('$method $url ($role only)', (route) => {
    it('answers a signed-out caller 401, not a validation error', async () => {
      const response = await send(route);

      expect(response.statusCode).toBe(401);
      expect(response.json()).not.toHaveProperty('details');
    });

    it('answers the other role 403, not a validation error', async () => {
      const response = await send(route, route.role === 'vendor' ? 'customer_a' : 'vendor_a');

      expect(response.statusCode).toBe(403);
      expect(response.json()).not.toHaveProperty('details');
    });

    it('still answers the right role 400 with details', async () => {
      const response = await send(route, route.role === 'vendor' ? 'vendor_a' : 'customer_a');

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ statusCode: 400, error: 'VALIDATION_ERROR' });
      if (route.schemaDetails === false) return;
      expect(response.json().details).toEqual(expect.any(Array));
      expect(response.json().details.length).toBeGreaterThan(0);
    });
  });

  describe.each(ANY_ROLE_ROUTES)('$method $url (any signed-in account)', (route) => {
    it('answers a signed-out caller 401, not a validation error', async () => {
      const response = await send(route);

      expect(response.statusCode).toBe(401);
      expect(response.json()).not.toHaveProperty('details');
    });

    it('still answers a signed-in caller 400 with details', async () => {
      const response = await send(route, 'customer_a');

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ statusCode: 400, error: 'VALIDATION_ERROR' });
      expect(response.json().details.length).toBeGreaterThan(0);
    });
  });

  /*
   * `/reports` has a limiter of its own, and that limiter is appended to
   * `onRequest`, after any guard declared there. The guard must therefore
   * sit in `preParsing`: a signed-out caller is counted and stopped at the
   * limit (429) rather than refused for free every time (401).
   */
  it('counts a signed-out caller against the report limiter before refusing it', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt <= REPORT_RATE_LIMIT.max; attempt += 1) {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/reports',
        headers: { 'content-type': 'application/json' },
        payload: [],
        remoteAddress: '203.0.113.9',
      });
      statuses.push(response.statusCode);
    }

    expect(statuses).toEqual([...Array<number>(REPORT_RATE_LIMIT.max).fill(401), 429]);
  });
});

/**
 * The same holds for the POSTs that carry a limiter keyed by account: a signed-out flood is counted, so the last request is 429, not a
 * free 401. The limits are small so the flood is cheap.
 */
describe('a signed-out flood of a rate-limited role-guarded POST is counted', () => {
  const LIMIT = 3;
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({
      env: {
        BOOKING_REQUEST_RATE_LIMIT_MAX: LIMIT,
        CONVERSATION_RATE_LIMIT_MAX: LIMIT,
        UPLOAD_RATE_LIMIT_MAX: LIMIT,
      },
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  it.each(['/booking-requests', '/conversations', '/upload/image'])(
    'POST %s answers 401 up to the limit, then 429',
    async (url) => {
      const statuses: number[] = [];
      for (let attempt = 0; attempt <= LIMIT; attempt += 1) {
        const response = await harness.app.inject({
          method: 'POST',
          url,
          headers: { 'content-type': 'application/json' },
          payload: [],
          remoteAddress: '203.0.113.10',
        });
        statuses.push(response.statusCode);
      }

      expect(statuses).toEqual([...Array<number>(LIMIT).fill(401), 429]);
    },
  );
});

/**
 * The table above pins the routes somebody remembered. This walks the routes
 * the server actually registers, so a new one cannot be forgotten: any route
 * that declares a params, querystring or body schema and also has a
 * `preHandler` guards after Fastify has already validated — answering a
 * signed-out caller with a 400 that describes the schema.
 */
describe('a route with an input schema does not guard in preHandler', () => {
  const routes: RouteOptions[] = [];
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ onRoute: (route) => routes.push(route) });
  });

  afterAll(async () => {
    await harness.close();
  });

  function hooks(value: unknown): unknown[] {
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
  }

  function hasInputSchema(route: RouteOptions): boolean {
    const schema = (route.schema ?? {}) as Record<string, unknown>;
    return ['params', 'querystring', 'body'].some((part) => schema[part] !== undefined);
  }

  it('walks the whole route table', () => {
    expect(routes.length).toBeGreaterThan(50);
    expect(routes.some((route) => route.url === '/users/me' && route.method === 'PUT')).toBe(true);
  });

  it('finds no schema-bearing route that authenticates in preHandler', () => {
    const offenders = routes
      .filter(
        (route) =>
          route.method !== 'HEAD' && hasInputSchema(route) && hooks(route.preHandler).length > 0,
      )
      .map((route) => `${String(route.method)} ${route.url}`)
      .sort();

    expect(offenders).toEqual([]);
  });
});

/**
 * A route's own limiter is appended to `onRequest` after any guard declared
 * there, so a guard in `onRequest` refuses a signed-out caller before it is
 * counted. On a rate-limited route the guard belongs in `preParsing`.
 */
describe('a route with its own rate limit does not guard in onRequest', () => {
  const routes: RouteOptions[] = [];
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ onRoute: (route) => routes.push(route) });
  });

  afterAll(async () => {
    await harness.close();
  });

  /** The limiter plugin appends its own hook to `onRequest`; any other one is a guard. */
  function hooks(value: unknown): unknown[] {
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
  }

  it('finds no route with an object rateLimit that declares an onRequest guard', () => {
    const limited = routes.filter((route) => {
      const limit = (route.config as { rateLimit?: unknown } | undefined)?.rateLimit;
      return typeof limit === 'object' && limit !== null;
    });
    const offenders = limited
      .filter((route) => route.method !== 'HEAD' && hooks(route.onRequest).length > 1)
      .map((route) => `${String(route.method)} ${route.url}`)
      .sort();

    expect(limited.length).toBeGreaterThan(3);
    expect(offenders).toEqual([]);
  });
});
