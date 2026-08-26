import { describe, expect, it } from 'vitest';
import { AppError } from './errors.js';
import { assertRole, authenticated } from './guards.js';
import type { AuthenticatedUser } from '../plugins/clerk-auth.js';

const vendor: AuthenticatedUser = {
  id: '9f1c2f0e-0000-4000-8000-000000000001',
  clerkUserId: 'user_vendor',
  role: 'vendor',
};

const customer: AuthenticatedUser = { ...vendor, clerkUserId: 'user_customer', role: 'customer' };

describe('authenticated', () => {
  it('returns the caller when one was resolved', () => {
    expect(authenticated(vendor)).toBe(vendor);
  });

  it('raises 401 when no caller was resolved', () => {
    try {
      authenticated(null);
      expect.unreachable('authenticated should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(401);
      expect((error as AppError).code).toBe('UNAUTHORIZED');
    }
  });
});

describe('assertRole', () => {
  it('admits a caller holding the required role', () => {
    expect(assertRole(vendor, ['vendor'])).toBe(vendor);
  });

  it('admits a caller holding any one of several accepted roles', () => {
    expect(assertRole(customer, ['customer', 'admin'])).toBe(customer);
  });

  it('raises 403 when the caller holds a different role', () => {
    try {
      assertRole(customer, ['vendor']);
      expect.unreachable('assertRole should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(403);
      expect((error as AppError).code).toBe('FORBIDDEN');
      expect((error as AppError).message).toBe('This endpoint requires the vendor role');
    }
  });

  it('raises 401 rather than 403 when there is no caller at all', () => {
    try {
      assertRole(null, ['vendor']);
      expect.unreachable('assertRole should have thrown');
    } catch (error) {
      expect((error as AppError).statusCode).toBe(401);
    }
  });
});
