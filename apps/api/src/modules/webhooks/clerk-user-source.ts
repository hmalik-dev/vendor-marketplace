import type { ClerkWebhookUserData } from './clerk.schemas.js';

/**
 * The read half of Clerk's user API that the API relies on outside a session:
 * `pnpm reconcile:clerk`, and the webhook asking who really holds a contested
 * address (VEN-386). One seam for both, so the suites supply one fake.
 */
export interface ClerkUserSource {
  /**
   * Fetches a page of Clerk users restricted to the given ids.
   *
   * Batched rather than one request per row: a bulk pass over every user would
   * otherwise be the thing most likely to hit Clerk's rate limit.
   */
  getUserList(params: {
    userId: string[];
    limit: number;
  }): Promise<{ data: ClerkApiUser[] } | ClerkApiUser[]>;
}

/** The camelCase shape the Clerk SDK returns, as opposed to a webhook payload. */
export interface ClerkApiUser {
  id: string;
  emailAddresses?: { id: string; emailAddress: string }[];
  primaryEmailAddressId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
}

/**
 * Clerk mints user ids with this prefix. The seeded marketplace accounts use
 * `seed_mkt_…`, which Clerk has never heard of.
 *
 * The distinction matters more than it looks: without it, every seeded vendor
 * reads as "deleted in Clerk" and a caller retires the entire public
 * marketplace. A row Clerk never issued is not a row Clerk deleted, and is
 * simply outside Clerk's jurisdiction.
 */
const CLERK_ID_PREFIX = 'user_';

export function isClerkIdentity(authUserId: string): boolean {
  return authUserId.startsWith(CLERK_ID_PREFIX);
}

export function clerkUsersIn(page: { data: ClerkApiUser[] } | ClerkApiUser[]): ClerkApiUser[] {
  return Array.isArray(page) ? page : page.data;
}

/**
 * Rewrites an SDK user into the snake_case payload a webhook would have
 * carried, so every caller reads it through the *same* handler and helpers the
 * live event uses. Translating once here is what keeps there being one update
 * behaviour and one deletion behaviour rather than two that can drift apart.
 */
export function asWebhookData(user: ClerkApiUser): ClerkWebhookUserData {
  return {
    id: user.id,
    email_addresses: (user.emailAddresses ?? []).map((address) => ({
      id: address.id,
      email_address: address.emailAddress,
    })),
    primary_email_address_id: user.primaryEmailAddressId ?? null,
    first_name: user.firstName ?? null,
    last_name: user.lastName ?? null,
    image_url: user.imageUrl ?? null,
  };
}
