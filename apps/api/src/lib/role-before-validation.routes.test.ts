import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from '../testing/test-server.js';

/**
 * Fastify validates a request schema before `preHandler`, so a role guard
 * registered there answers a caller who has not proved their role with a 400
 * that describes the schema. Every role-gated route with a body schema must
 * guard in `onRequest` instead (`requireRoleBeforeValidation`).
 *
 * The body is `[]`: no object schema accepts it, so a route that validated
 * first would answer 400 to all three callers.
 */
const ID = '11111111-1111-4111-8111-111111111111';

interface GuardedRoute {
  readonly method: 'POST' | 'PUT' | 'PATCH';
  readonly url: string;
  readonly role: 'vendor' | 'customer';
}

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
      ...(user ? { headers: bearer(user) } : {}),
      payload: [],
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
      expect(response.json().details).toEqual(expect.any(Array));
      expect(response.json().details.length).toBeGreaterThan(0);
    });
  });
});
