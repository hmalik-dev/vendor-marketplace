import type { UserRow } from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { softDeleteUserByClerkId, updateUserByClerkId } from '../users/users.dao.js';
import { mirroredClerkName, syncUserFromClerk } from '../users/users.service.js';
import { primaryEmail, type ClerkWebhookEvent } from './clerk.schemas.js';

export type ClerkWebhookOutcome = 'created' | 'updated' | 'deleted' | 'ignored';

/**
 * Applies one verified Clerk lifecycle event. Events arrive out of order and
 * are redelivered on any non-2xx reply, so every branch is idempotent and an
 * event for an unknown user is a no-op rather than an error.
 */
export async function applyClerkUserEvent(
  db: AppDatabase,
  event: ClerkWebhookEvent,
): Promise<ClerkWebhookOutcome> {
  const clerkUserId = event.data.id;

  switch (event.type) {
    case 'user.created': {
      const email = primaryEmail(event.data);
      if (!email) {
        return 'ignored';
      }

      const created: UserRow | null = await syncUserFromClerk(db, {
        clerkUserId,
        email,
        firstName: event.data.first_name ?? '',
        lastName: event.data.last_name ?? '',
        roleHint: event.data.unsafe_metadata?.role,
        avatarUrl: event.data.image_url || null,
      });

      return created ? 'created' : 'ignored';
    }

    case 'user.updated': {
      // Role is fixed at sign-up; only contact details are mirrored onward.
      const email = primaryEmail(event.data);
      /*
       * The names go through `mirroredClerkName` here as well as on the create
       * path: this patch does not pass through `syncUserFromClerk`, so a bidi
       * control stripped at sign-up would come straight back the next time the
       * account holder edited their Clerk profile (#398).
       */
      const patch = {
        ...(email === null ? {} : { email }),
        ...(event.data.first_name === undefined || event.data.first_name === null
          ? {}
          : { firstName: mirroredClerkName(event.data.first_name) }),
        ...(event.data.last_name === undefined || event.data.last_name === null
          ? {}
          : { lastName: mirroredClerkName(event.data.last_name) }),
        ...(event.data.image_url === undefined ? {} : { avatarUrl: event.data.image_url || null }),
      };

      const updated = await updateUserByClerkId(db, clerkUserId, patch);
      return updated ? 'updated' : 'ignored';
    }

    case 'user.deleted': {
      const deleted = await softDeleteUserByClerkId(db, clerkUserId);
      return deleted ? 'deleted' : 'ignored';
    }

    default:
      return 'ignored';
  }
}
