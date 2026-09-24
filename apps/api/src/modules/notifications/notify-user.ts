import type { NotificationType } from '@vendor-marketplace/shared';
import type { EventHub } from '../../lib/event-stream.js';
import { insertNotification } from '../messaging/messaging.dao.js';
import { notificationHref } from '../messaging/messaging.service.js';
import { queueNotificationEmail, type NotificationEmailDeps } from './notification-email.js';

/** What a background job or a webhook needs to tell one person something. */
export interface NotifyDeps {
  hub: EventHub;
  mail: NotificationEmailDeps;
}

export interface NotificationCopy {
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/**
 * The bell, the live push and the email, in that order, for a vendor.
 *
 * Callers run after their own write has committed, and a failure here must not
 * undo it — a payout that moved cannot be un-moved because a bell insert threw —
 * so this logs and swallows. The email is queued off the request path and
 * swallows its own failures already.
 */
export async function notifyVendorUser(
  deps: NotifyDeps,
  userId: string,
  copy: NotificationCopy,
): Promise<void> {
  try {
    const stored = await insertNotification(deps.mail.db, { userId, ...copy });

    if (!stored) {
      return;
    }

    deps.hub.publish(userId, {
      type: 'new_notification',
      notification: {
        id: stored.id,
        type: stored.type,
        title: stored.title,
        body: stored.body,
        href: notificationHref(stored),
        readAt: stored.readAt,
        createdAt: stored.createdAt,
      },
    });

    queueNotificationEmail(deps.mail, stored, 'vendor');
  } catch (error) {
    deps.mail.log.error(
      { userId, type: copy.type, err: error },
      'Could not notify the vendor; the action it announces succeeded',
    );
  }
}

/** The vendor-facing copy for each payout event. Names the fix, never Stripe's reason. */
export const PAYOUT_NOTICES = {
  sent: {
    type: 'payout_sent',
    title: 'A payout is on its way',
    body: 'Your payment for a completed booking has been sent to your Stripe account. Stripe pays it on to your bank on its own schedule.',
  },
  connected: {
    type: 'stripe_onboarding_complete',
    title: 'Payouts are set up',
    body: 'Your payout account is connected. Payments now reach you after each event.',
  },
  paused: {
    type: 'payouts_paused',
    title: 'Payouts are paused',
    body: 'We cannot send payments to you right now. Open Payments to fix your payout details.',
  },
} as const satisfies Record<string, Omit<NotificationCopy, 'data'>>;
