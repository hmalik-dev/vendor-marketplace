import type { AppDatabase } from '../../lib/database.js';
import { listLiveClerkIdentities } from '../users/users.dao.js';
import { applyClerkUserEvent } from './clerk.service.js';
import type { ClerkWebhookUserData } from './clerk.schemas.js';

/**
 * Repairs the drift a misrouted webhook left behind.
 *
 * For the whole life of the deployment, the only Svix endpoint on the Clerk app
 * was a `clerk webhooks listen` relay token, so no production webhook ever
 * reached the API. Sign-up still worked — a user row is created lazily on the
 * first authenticated request — but every `user.updated` and `user.deleted`
 * was silently dropped, leaving stale names and emails locally and users
 * deleted in Clerk still present here.
 *
 * Repointing the endpoint stops the bleeding; it does not undo it. This pass
 * does, and is written to be re-runnable, because this will not be the last
 * time a webhook is misconfigured.
 */

/** The subset of the Clerk SDK this pass needs, so the suite can supply it. */
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

export interface ReconcileSummary {
  /** Rows examined — every live local row, since Clerk owns none of the others. */
  examined: number;
  /** Rows whose name, email, or avatar disagreed with Clerk and were corrected. */
  updated: number;
  /** Rows whose Clerk identity no longer exists, retired as `user.deleted` would. */
  deleted: number;
  /** Rows already agreeing with Clerk. On a second run this is all of them. */
  unchanged: number;
}

/** Clerk's own cap on ids per `getUserList` query. */
const BATCH_SIZE = 100;

function unwrap(page: { data: ClerkApiUser[] } | ClerkApiUser[]): ClerkApiUser[] {
  return Array.isArray(page) ? page : page.data;
}

/**
 * Rewrites an SDK user into the snake_case payload a webhook would have
 * carried, so reconciliation can hand it to the *same* handler the live event
 * uses. Translating once here is what keeps there being one update behaviour
 * and one deletion behaviour rather than two that can drift apart.
 */
function asWebhookData(user: ClerkApiUser): ClerkWebhookUserData {
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

export async function reconcileClerkUsers(
  db: AppDatabase,
  clerk: ClerkUserSource,
): Promise<ReconcileSummary> {
  const local = await listLiveClerkIdentities(db);
  const summary: ReconcileSummary = {
    examined: local.length,
    updated: 0,
    deleted: 0,
    unchanged: 0,
  };

  if (local.length === 0) {
    return summary;
  }

  /*
   * Keyed by Clerk id and built from batched lookups. A local row whose id is
   * absent from the response is one Clerk no longer has — which is exactly the
   * case the missed `user.deleted` events left behind.
   */
  const remote = new Map<string, ClerkApiUser>();

  for (let index = 0; index < local.length; index += BATCH_SIZE) {
    const batch = local.slice(index, index + BATCH_SIZE);
    const page = await clerk.getUserList({
      userId: batch.map((row) => row.clerkUserId),
      limit: BATCH_SIZE,
    });

    for (const user of unwrap(page)) {
      remote.set(user.id, user);
    }
  }

  for (const row of local) {
    const user = remote.get(row.clerkUserId);

    if (!user) {
      // The same path the event would have taken, so deletion behaves once.
      const outcome = await applyClerkUserEvent(db, {
        type: 'user.deleted',
        data: { id: row.clerkUserId },
      });

      if (outcome === 'deleted') {
        summary.deleted += 1;
      } else {
        summary.unchanged += 1;
      }
      continue;
    }

    const data = asWebhookData(user);
    const email =
      data.email_addresses?.find((address) => address.id === data.primary_email_address_id)
        ?.email_address ??
      data.email_addresses?.[0]?.email_address ??
      null;

    /*
     * Compared before writing, rather than writing unconditionally and calling
     * it idempotent. A blind update would touch `updated_at` on every row on
     * every run, which is not "changes nothing the second time" — and it is the
     * count below that the idempotency assertion actually rests on.
     */
    const drifted =
      (email !== null && email !== row.email) ||
      // Null means Clerk has no opinion, and the handler's patch omits the
      // field entirely. Treating that as drift would report a correction the
      // write never makes, and the next run would report it again.
      (data.first_name !== null && data.first_name !== row.firstName) ||
      (data.last_name !== null && data.last_name !== row.lastName) ||
      (data.image_url || null) !== row.avatarUrl;

    if (!drifted) {
      summary.unchanged += 1;
      continue;
    }

    const outcome = await applyClerkUserEvent(db, { type: 'user.updated', data });

    if (outcome === 'updated') {
      summary.updated += 1;
    } else {
      summary.unchanged += 1;
    }
  }

  return summary;
}
