import { describe, expect, it } from 'vitest';
import { wireUserSchema } from './wire-schemas';

const WIRE_USER = {
  id: '4a5e9f3c-0f6d-4b3a-9a4e-1c2d3e4f5a6b',
  clerkUserId: 'user_123',
  email: 'ada@example.com',
  role: 'customer',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: null,
  avatarUrl: null,
  stripeCustomerId: null,
  bio: null,
  city: null,
  state: null,
  budgetTier: null,
  typicalGuestCountMin: null,
  typicalGuestCountMax: null,
  avgCustomerRating: 4.5,
  customerReviewCount: 2,
  totalBookingsCount: 3,
  completedBookingsCount: 2,
  cancelledBookingsCount: 1,
  isBanned: false,
  bannedAt: null,
  deletedAt: null,
  createdAt: '2026-08-26T10:00:00.000Z',
  updatedAt: '2026-08-26T10:30:00.000Z',
};

describe('wireUserSchema', () => {
  it('coerces the ISO timestamps the API sends back into Dates', () => {
    const user = wireUserSchema.parse(WIRE_USER);

    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.createdAt.toISOString()).toBe('2026-08-26T10:00:00.000Z');
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('keeps the nullable timestamps null rather than coercing them to the epoch', () => {
    const user = wireUserSchema.parse(WIRE_USER);

    expect(user.bannedAt).toBeNull();
    expect(user.deletedAt).toBeNull();
  });

  it('coerces a nullable timestamp when the API does send one', () => {
    const user = wireUserSchema.parse({ ...WIRE_USER, deletedAt: '2026-08-20T09:00:00.000Z' });

    expect(user.deletedAt).toBeInstanceOf(Date);
  });

  it('keeps the numeric rating a number rather than the driver string', () => {
    const user = wireUserSchema.parse(WIRE_USER);

    expect(user.avgCustomerRating).toBe(4.5);
  });

  it('rejects a payload missing a required field', () => {
    const withoutRole: Record<string, unknown> = { ...WIRE_USER };
    delete withoutRole.role;

    expect(wireUserSchema.safeParse(withoutRole).success).toBe(false);
  });
});
