import { BRAND_NAME, type NotificationType } from '@vendor-marketplace/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { NotificationRow } from '@vendor-marketplace/db';
import type { AppDatabase } from '../../lib/database.js';
import { notificationHref } from '../messaging/messaging.service.js';
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
 * - **No duration is hard-coded.** `new_request`'s body states the row's own
 *   deadline as a date, which D16 requires. It used to read the flat
 *   `bookingRequestWindowPhrase()`; #401 capped the window at the event, so
 *   that phrase became false for a request sent close to its date — and a
 *   countdown could not replace it here, because an email body is written once
 *   and read days later.
 */

/**
 * Which events reach an inbox, and what the one button says.
 *
 * **Labels only — the destination comes from `notificationHref`,** the same
 * function the bell uses. That is not tidiness: a second table of paths went
 * wrong in three ways at once when it existed. It sent `new_review` to
 * `/vendor/reviews`, which is not a route; it sent the *customer* half of a
 * `vendor_to_customer` review to a `/vendor/*` URL that refuses them; and it
 * promised "Write a review" on a page that has no review form. Every one of
 * those is a question `notificationHref` had already answered, including the
 * direction-dependence a review needs and the deliberate refusal to deep-link
 * `/bookings/<id>` for a type that can reach a vendor.
 *
 * A notification row names its own recipient, so "emails whom" is already
 * decided by whoever the row was written for — `booking_confirmed` writes two
 * rows and therefore sends two emails, one per party, which is exactly what the
 * ticket's table asks for.
 *
 * `new_message` is **absent on purpose**: per-message email is how a product
 * teaches people to mute it. In-app only in MVP; a digest is post-MVP.
 */
const EMAIL_LABELS: Partial<Record<NotificationType, string>> = {
  /*
   * "Dashboard", not "the request": `notificationHref` sends `new_request` to
   * `/vendor/dashboard`, and the label has to name where the button actually
   * goes. Taking the destination from one place and the wording from another is
   * how an email promises a surface it does not open.
   */
  new_request: 'Open your dashboard',
  request_quoted: 'See the quote',
  request_accepted: 'See the booking',
  request_declined: 'Find another vendor',
  request_expired: 'Open your bookings',
  request_cancelled: 'Open your bookings',
  booking_confirmed: 'See the booking',
  booking_completed: 'See the booking',
  booking_cancelled: 'Open your bookings',
  new_review: 'Read the review',
  payout_sent: 'Open your dashboard',
  stripe_onboarding_complete: 'Open your dashboard',
  tag_suggestion_approved: 'Open your profile',
};

/**
 * The vendor's own half of the product, where the shared path is customer-only.
 *
 * `/bookings` is gated by `requireRole('customer')`, so a vendor following it
 * is redirected — and "one primary action, pointing at the exact surface" is
 * not satisfied by a link that bounces. The bell has the same shape and lives
 * with it because a redirect inside the app is cheap; an email is read once,
 * often on a phone, and a bounce there is the whole interaction.
 */
function forVendor(href: string): string {
  return href === '/bookings' || href.startsWith('/bookings/') ? '/vendor/bookings' : href;
}

/**
 * The row, as both the bell and the inbox read it.
 *
 * `data` is here because `notificationHref` needs it — a review's destination
 * depends on whether the payload carries a vendor slug, and a quoted request
 * deep-links by id.
 */
export type NotificationEmailRow = Pick<
  NotificationRow,
  'id' | 'userId' | 'type' | 'title' | 'body' | 'data'
>;

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
  const label = EMAIL_LABELS[row.type as NotificationType];

  if (!label) {
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

    /*
     * `?? '/bookings'` is unreachable in practice — every type in
     * `EMAIL_LABELS` carries a payload `notificationHref` resolves — but a null
     * href would otherwise render `${origin}null`, and a broken link in an
     * archived email is worse than a general one.
     */
    const href = notificationHref(row as NotificationRow) ?? '/bookings';
    const url = `${deps.webOrigin}${audience === 'vendor' ? forVendor(href) : href}`;

    await deps.email.send({
      to: recipient.email,
      subject: row.title,
      html: renderHtml({ title: row.title, body: row.body, label, url }),
      text: renderText({ title: row.title, body: row.body, label, url }),
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
    /*
     * 44px tall, and the arithmetic is why the numbers are what they are:
     * `04-laws.md` sets a 44x44 minimum for anything a finger taps, and a
     * browser pass measured this at **39px** with `padding:11px 18px` — 11 + 11
     * plus a 17px default line box. `line-height` is stated rather than
     * inherited because an email client supplies its own default, so leaving it
     * open means the one number that decides the height is the one number this
     * template does not control. 14 + 14 + 16 = 44.
     */
    `<a href="${escapeHtml(url)}" style="display:inline-block;background:#B4552F;color:#FFFDF9;`,
    'text-decoration:none;font-size:14px;line-height:16px;font-weight:600;padding:14px 18px;',
    'border-radius:10px;">',
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
