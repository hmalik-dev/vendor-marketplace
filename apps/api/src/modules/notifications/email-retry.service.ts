import { EMAIL_RETRY_MAX_ATTEMPTS, EMAIL_RETRY_WINDOW_MS } from '@vendor-marketplace/shared';
import type { Clock } from '../../plugins/clock.js';
import {
  retryFailedApplicationConfirmationEmails,
  retryFailedInviteEmails,
  type VendorInviteMailDeps,
} from '../vendor-invites/vendor-invites.service.js';
import { lockRetryableDelivery } from './email-delivery.dao.js';
import { findNotificationForRetry } from './notification-email.dao.js';
import { sendNotificationEmail, type NotificationEmailDeps } from './notification-email.js';

/** How many notifications one tick may try, so a Resend outage cannot make a tick unbounded. */
const NOTIFICATION_RETRY_BATCH = 50;

/**
 * Re-sends the notification emails that never left (VEN-465).
 *
 * Each candidate is claimed in its own transaction with `FOR UPDATE SKIP LOCKED`
 * on its latest `failed` attempt (`lockRetryableDelivery` states the full
 * predicate), and the send is `sendNotificationEmail` — the same path as the
 * first attempt, rendered from the notification row, keyed on its uuid at
 * Resend, and writing its own attempt row. A sweep that overlaps this one skips
 * the locked candidate; once the transaction commits, the new attempt row makes
 * the old one non-latest, so nothing is sent twice. The send holds a
 * connection for at most `EMAIL_SEND_TIMEOUT_MS`, which is the price of the row
 * lock being the claim.
 *
 * A notification is tried once per call however it ends: a candidate that
 * records no new row (its recipient's address is being changed, say) would
 * otherwise be picked again forever within the same tick.
 *
 * Returns how many notifications it tried.
 */
export async function retryFailedNotificationEmails(
  deps: NotificationEmailDeps,
  now: Clock,
): Promise<number> {
  const tried: string[] = [];

  while (tried.length < NOTIFICATION_RETRY_BATCH) {
    const notificationId = await deps.db.transaction(async (tx) => {
      const candidate = await lockRetryableDelivery(tx, {
        now: now(),
        maxAttempts: EMAIL_RETRY_MAX_ATTEMPTS,
        windowMs: EMAIL_RETRY_WINDOW_MS,
        exclude: tried,
      });

      if (!candidate) {
        return null;
      }

      const notification = await findNotificationForRetry(tx, candidate.notificationId);

      if (notification) {
        await sendNotificationEmail({ ...deps, db: tx }, notification.row, notification.audience);
      }

      return candidate.notificationId;
    });

    if (notificationId === null) {
      break;
    }

    tried.push(notificationId);
  }

  return tried.length;
}

export interface EmailRetryDeps {
  notifications: NotificationEmailDeps;
  invites: VendorInviteMailDeps;
}

/** One sweep tick: notification emails, then vendor invites, then waitlist confirmations. */
export async function retryFailedEmails(
  deps: EmailRetryDeps,
  now: Clock,
): Promise<{ notifications: number; invites: number; applicationConfirmations: number }> {
  const notifications = await retryFailedNotificationEmails(deps.notifications, now);
  const invites = await retryFailedInviteEmails(deps.invites);
  const applicationConfirmations = await retryFailedApplicationConfirmationEmails(deps.invites);

  return { notifications, invites, applicationConfirmations };
}
