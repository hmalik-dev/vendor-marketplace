import { BRAND_NAME, type NotificationType } from '@vendor-marketplace/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDatabase } from '../../lib/database.js';
import type { EmailGateway } from '../../lib/email.js';
import { findUserEmail } from './notification-email.dao.js';

/**
 * **The email is the notification, rendered for an inbox.**
 *
 * That is the whole design, and it is what the ticket's "the two cannot drift"
 * requirement actually asks for. Subject and body come from the notification
 * row that was just written, so there is no second copy of the wording to keep
 * in step, no second decision about who is told, and no way for an event to
 * notify in-app and not by email by accident. Everything this file adds is what
 * an inbox needs and a bell does not: an address, a greeting, one action, and a
 * plain-text alternative.
 *
 * Three consequences worth stating, because they are the acceptance criteria
 * falling out of the design rather than being met one at a time:
 *
 * - **Money positions are already correct.** `admin.service.ts` writes a
 *   *per-recipient* body precisely because one shared string told a vendor
 *   their payment had been refunded when they had not paid. Reusing that body
 *   means both parties read the same refund figure by construction.
 * - **No platform statistic and no vendor-side fee claim can appear**, because
 *   the in-app copy carries neither and this adds no numbers of its own.
 * - **No duration is hard-coded.** `new_request`'s body already reads the
 *   window through `bookingRequestWindowPhrase()`, which D16 requires.
 */

/**
 * Which events reach an inbox, and the one action each carries.
 *
 * A notification row names its own recipient, so "emails whom" is already
 * decided by whoever the row was written for — `booking_confirmed` writes two
 * rows and therefore sends two emails, one per party, which is exactly what the
 * ticket's table asks for.
 *
 * `new_message` is **absent on purpose**: per-message email is how a product
 * teaches people to mute it. In-app only in MVP; a digest is post-MVP.
 */
const EMAIL_ACTIONS: Partial<Record<NotificationType, { label: string; path: string }>> = {
  new_request: { label: 'Open the request', path: '/vendor/bookings' },
  request_quoted: { label: 'See the quote', path: '/bookings' },
  request_accepted: { label: 'See the booking', path: '/bookings' },
  request_declined: { label: 'Find another vendor', path: '/search' },
  request_expired: { label: 'Send it again', path: '/search' },
  request_cancelled: { label: 'Open your bookings', path: '/vendor/bookings' },
  booking_confirmed: { label: 'See the booking', path: '/bookings' },
  booking_completed: { label: 'Write a review', path: '/bookings' },
  booking_cancelled: { label: 'Open your bookings', path: '/bookings' },
  new_review: { label: 'Read the review', path: '/vendor/reviews' },
  payout_sent: { label: 'See your payouts', path: '/vendor/payments' },
  stripe_onboarding_complete: { label: 'Open your dashboard', path: '/vendor/dashboard' },
  tag_suggestion_approved: { label: 'Open your profile', path: '/vendor/profile/edit' },
};

/**
 * The vendor-side surfaces, so an action points at the reader's own half of the
 * product.
 *
 * A vendor sent to `/bookings` lands on the customer hub and is redirected;
 * `04-laws.md`'s "one primary action per email, pointing at the exact surface"
 * is not satisfied by a link that bounces.
 */
const VENDOR_PATHS: Partial<Record<NotificationType, string>> = {
  booking_confirmed: '/vendor/bookings',
  booking_cancelled: '/vendor/bookings',
};

export interface NotificationEmailRow {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
}

export interface NotificationEmailDeps {
  db: AppDatabase;
  email: EmailGateway;
  log: FastifyBaseLogger;
  /** `canonicalWebOrigin(env)` — never `BRAND_DOMAIN`, which is display only. */
  webOrigin: string;
}

/**
 * Sends the email for a notification row, if that event has one.
 *
 * **Never throws, and never runs inside a transaction.** A booking that
 * succeeded must not appear to fail because an email bounced, so every failure
 * is logged and swallowed here rather than at each of the seven call sites —
 * one place to get right instead of seven to remember.
 */
export async function sendNotificationEmail(
  deps: NotificationEmailDeps,
  row: NotificationEmailRow,
  /** `vendor` when the recipient reads this on their own side of the product. */
  audience: 'customer' | 'vendor' = 'customer',
): Promise<void> {
  const action = EMAIL_ACTIONS[row.type as NotificationType];

  if (!action) {
    return;
  }

  try {
    const recipient = await findUserEmail(deps.db, row.userId);

    if (!recipient) {
      /*
       * Deleted in Clerk between the event and the send, or a row whose user
       * was removed. Skip rather than crash — the in-app notification is
       * already durable and this is the half that has nowhere to go.
       */
      deps.log.info(
        { notificationId: row.id },
        'Skipped an email for a user that no longer exists',
      );
      return;
    }

    const path =
      (audience === 'vendor' ? VENDOR_PATHS[row.type as NotificationType] : undefined) ??
      action.path;
    const url = `${deps.webOrigin}${path}`;

    await deps.email.send({
      to: recipient.email,
      subject: row.title,
      html: renderHtml({ title: row.title, body: row.body, label: action.label, url }),
      text: renderText({ title: row.title, body: row.body, label: action.label, url }),
      idempotencyKey: row.id,
    });
  } catch (error) {
    /*
     * `error`, and the operation continues. The identifiers only — never the
     * recipient's address, which `log-redaction.ts` has no shape to strip from
     * a free-form message.
     */
    deps.log.error(
      { notificationId: row.id, type: row.type, err: error },
      'Transactional email failed to send; the operation itself succeeded',
    );
  }
}

interface Rendered {
  title: string;
  body: string | null;
  label: string;
  url: string;
}

/**
 * One table, inline styles, no external assets.
 *
 * Email clients strip `<style>` blocks and refuse remote CSS, so this is the
 * one place in the product where inline values are correct rather than the
 * old-design debt `theme.css` exists to retire. It renders at 390, 768 and 1440
 * because it is a single centred column with a `max-width` and no fixed widths
 * — there is no layout to break.
 */
function renderHtml({ title, body, label, url }: Rendered): string {
  return [
    '<!doctype html><html><body style="margin:0;padding:24px;background:#F8F5EF;',
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;\">",
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ',
    'style="max-width:520px;margin:0 auto;background:#FFFDF9;border:1px solid #E4DDD1;',
    'border-radius:12px;padding:28px;">',
    `<tr><td><p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6B6459;">${escapeHtml(BRAND_NAME)}</p>`,
    `<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#23201C;">${escapeHtml(title)}</h1>`,
    body
      ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#4A443C;">${escapeHtml(body)}</p>`
      : '',
    `<a href="${escapeHtml(url)}" style="display:inline-block;background:#B4552F;color:#FFFDF9;`,
    'text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px;">',
    `${escapeHtml(label)}</a>`,
    '</td></tr></table></body></html>',
  ].join('');
}

/** The plain-text alternative. Same words, same one action, no markup. */
function renderText({ title, body, label, url }: Rendered): string {
  return [title, '', body ?? '', '', `${label}: ${url}`, '', BRAND_NAME]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');
}

/**
 * A vendor's business name and a customer's note both reach these templates
 * verbatim, and both are user input.
 *
 * `31-content-voice.md` requires business names to render exactly as entered,
 * which means an apostrophe or an ampersand has to survive — and an unescaped
 * `<` in a note would be markup in somebody's inbox.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
