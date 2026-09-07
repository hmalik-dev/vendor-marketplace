import { BRAND_NAME } from './brand.js';

/**
 * Contact support — frame `29 Contact support`, which lives in
 * `design/contact-support/` rather than in `Orla - Screens.dc.html`.
 *
 * The screen is a form that sends **one email** and says so. It is still not a
 * helpdesk: no threads, no in-app replies, no ticket status the sender can poll,
 * no attachments. What #431 added is on the **operator's** side of the wall — a
 * case row in `/admin/cases`, because a report that freezes a vendor's payout
 * has to be findable by the person who has to unfreeze it. Nothing about the
 * sender's experience changed, and the reference is still the only handle they
 * are given.
 *
 * Everything here is the vocabulary both apps read from, so the topic a visitor
 * picks and the topic a human reads in the subject line cannot drift apart.
 */

/** Where every `Contact support` affordance in the product leads. */
export const SUPPORT_PATH = '/support';

/**
 * Five topics, exactly — the routing key in the email subject.
 *
 * It earns its place because a human reads it, not because it feeds a queue,
 * which is why there is no sixth "other, but specific" option: a longer list
 * asks the visitor to do triage they cannot do.
 */
export const SUPPORT_TOPICS = [
  'something-broke',
  'booking-or-payment',
  'vendor-profile',
  'trust-and-safety',
  'something-else',
] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

/** The literal strings frame `29` draws, in the order it draws them. */
export const SUPPORT_TOPIC_LABELS: Record<SupportTopic, string> = {
  'something-broke': 'Something broke',
  'booking-or-payment': 'A booking or payment',
  'vendor-profile': 'My vendor profile',
  'trust-and-safety': 'Trust & safety',
  'something-else': 'Something else',
};

/**
 * Preselected when an error reference is attached, and only then.
 *
 * A visitor who arrived from the 500 screen has already said what happened by
 * getting there; asking them to repeat it in a dropdown answers nothing.
 */
export const SUPPORT_TOPIC_WITH_REFERENCE: SupportTopic = 'something-broke';

/**
 * Preselected when a **booking** is attached, and only then (#425).
 *
 * Not `SUPPORT_TOPIC_WITH_REFERENCE`. A customer who followed `Report a
 * problem` off their own booking has already said which of the five this is,
 * and `Something broke` would be the wrong one twice over: it reads as a bug
 * report, and it is the topic a human triages away from the money.
 */
export const SUPPORT_TOPIC_WITH_BOOKING: SupportTopic = 'booking-or-payment';

/**
 * The longest message the form accepts, at the schema **and** in the textarea.
 *
 * #408's rule: a value the schema accepts must fit whatever receives it. What
 * receives this is one Resend send, whose own payload ceiling is orders of
 * magnitude above this — so the binding constraint is the person who reads it,
 * not the transport. The `maxLength` on the control is what keeps the refusal
 * unreachable by typing.
 */
export const MAX_SUPPORT_MESSAGE_LENGTH = 4_000;

/**
 * Bounds on the error context the 500 screen hands over. Both arrive in the
 * query string, so both are attacker-controlled: they are bounded and shaped
 * before anything renders or sends them.
 */
export const MAX_SUPPORT_ERROR_DIGEST_LENGTH = 128;
export const MAX_SUPPORT_ERROR_ROUTE_LENGTH = 512;

/**
 * Next's `error.digest` is a hash it also writes to the server log; nothing
 * else is ever a legitimate value here.
 */
export const SUPPORT_ERROR_DIGEST_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * The reference the visitor keeps — `ORL-4K7Q-P2` in the frame.
 *
 * **This is the message's own id, not the error digest.** A send from the
 * footer carries no digest, so the digest cannot be what the sent state hands
 * back; and the reference has to exist before the send resolves, because a
 * message that failed to send is still something the visitor can ask about.
 *
 * Derived from `BRAND_NAME` rather than written out: the name has already
 * moved twice, and this string is read aloud to support.
 */
export const SUPPORT_REFERENCE_PREFIX = BRAND_NAME.slice(0, 3).toUpperCase();

/**
 * Crockford's base32 alphabet minus its ambiguous characters, because this
 * code is transcribed by hand out of an email and read down a phone line.
 * `I`, `L`, `O`, `U`, `0` and `1` are absent for that reason and no other.
 */
export const SUPPORT_REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** `ORL-XXXX-XX`, the shape frame `29` draws. */
export const SUPPORT_REFERENCE_PATTERN = new RegExp(
  `^${SUPPORT_REFERENCE_PREFIX}-[${SUPPORT_REFERENCE_ALPHABET}]{4}-[${SUPPORT_REFERENCE_ALPHABET}]{2}$`,
);

/**
 * How a case reached the queue (#431).
 *
 * **One inbox, three doors.** A report a customer typed, a chargeback a card
 * network opened and a report raised from inside the product are the same
 * object to the operator working them — each needs a ruling, and the first two
 * freeze a payout — so the origin is a column rather than a second table. The
 * alternative was three queues, and an operator working three queues works
 * none of them.
 *
 * `user_report` is #436's door and it is the one that moves no money. A report
 * about a profile, a review, a thread or a photo names its subject in
 * `subject_type` / `subject_id` and places no payout hold, so there is no hold
 * to announce to the vendor — which is the asymmetry #431 closed between the
 * other two, kept closed here by not opening a third way to freeze money
 * silently. Money still moves through `POST /support/messages` alone.
 */
export const SUPPORT_CASE_ORIGINS = ['support_message', 'chargeback', 'user_report'] as const;
export type SupportCaseOrigin = (typeof SUPPORT_CASE_ORIGINS)[number];

/**
 * The platform's disposition, and **only** the platform's.
 *
 * Deliberately two members and not four. A chargeback also has a *network*
 * outcome — Stripe's `won`, `lost`, `warning_closed` — and folding those in here
 * would make one column answer two different questions: what the card network
 * decided, and what we decided to do about it. They routinely disagree, and the
 * reconciliation between them is the operator's job, so the network's answer
 * lives in its own nullable column and this one stays the console's.
 */
export const SUPPORT_CASE_STATUSES = ['open', 'resolved'] as const;
export type SupportCaseStatus = (typeof SUPPORT_CASE_STATUSES)[number];

// --- In-product reporting (#436) -------------------------------------------

/**
 * What a report is *about*.
 *
 * Four surfaces, and they are the four a signed-in person can actually see
 * something wrong on: a vendor's storefront, a review somebody left, a message
 * thread they are in, and a photo the platform publishes on a vendor's behalf.
 * A fifth member is a fifth report control on a screen, so the list grows when
 * a screen does and not before.
 *
 * **The pair `(subject_type, subject_id)` rather than four nullable foreign
 * keys**, and the id deliberately carries no constraint — the same shape and
 * the same reason as `admin_actions`. A report has to outlive the thing it is
 * about: a review deleted by the moderation it triggered would otherwise take
 * the only record of why it was deleted with it.
 *
 * A **booking** is deliberately not here. Reporting one freezes a vendor's
 * payout, and that path already exists end to end at `POST /support/messages`
 * — hold, unwind, vendor notice and all. A second door onto the same money is
 * how the two come to disagree about when a payout freezes.
 */
export const REPORT_SUBJECTS = [
  'vendor_profile',
  'review',
  'conversation',
  'portfolio_item',
] as const;
export type ReportSubject = (typeof REPORT_SUBJECTS)[number];

/** What the operator reads in the queue, and what the reporter picked. */
export const REPORT_SUBJECT_LABELS: Record<ReportSubject, string> = {
  vendor_profile: 'Vendor profile',
  review: 'Review',
  conversation: 'Message thread',
  portfolio_item: 'Portfolio photo',
};

/**
 * Why, from a short list.
 *
 * Short for the reason `SUPPORT_TOPICS` is five: the list is a routing key a
 * human reads, and a longer one asks the reporter to do triage they cannot do.
 * `off-platform-payment` earns its own member rather than folding into
 * `something-else` because it is the single complaint the marketplace most
 * needs counted — it is the one that takes the transaction off the platform
 * and the protection with it.
 */
export const REPORT_REASONS = [
  'spam-or-scam',
  'off-platform-payment',
  'harassment',
  'inappropriate-content',
  'misleading-information',
  'something-else',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * The literal strings the report dialog draws, in the order it draws them.
 *
 * `BRAND_NAME` rather than the word, by the project law that the product name
 * is never written as a literal.
 */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  'spam-or-scam': 'Spam or a scam',
  'off-platform-payment': `Asking to pay outside ${BRAND_NAME}`,
  harassment: 'Harassment or abuse',
  'inappropriate-content': 'Inappropriate content',
  'misleading-information': 'Misleading information',
  'something-else': 'Something else',
};

/**
 * Optional context, and shorter than a support message on purpose.
 *
 * The reporter has already said which of four things and which of six reasons,
 * so this is the sentence that adds what the enums cannot. `/support/messages`
 * is where a longer account belongs, and the dialog says so.
 */
export const MAX_REPORT_DETAIL_LENGTH = 1_000;

/**
 * Six an hour, per account — deliberately the same allowance as the support
 * form and for the same reason.
 *
 * A report makes this process send mail and writes a row an operator has to
 * work, so an unbounded control is a way to flood a human queue from one
 * account. Six is above anything a real person does in an hour and orders of
 * magnitude below anything worth automating.
 *
 * The route is authenticated, so this is keyed by account and never by IP: a
 * shared office address must not spend one person's allowance on everybody
 * behind it.
 */
export const REPORT_RATE_LIMIT = { max: 6, timeWindow: '1 hour' } as const;

/**
 * The topic a report files under.
 *
 * Every report is trust and safety by construction — that is what the four
 * subjects have in common — so the case carries the member that already exists
 * rather than a parallel vocabulary. An operator filtering the queue for
 * `trust-and-safety` sees the typed complaints and the in-product reports
 * together, which is the point of one queue.
 */
export const REPORT_CASE_TOPIC: SupportTopic = 'trust-and-safety';
