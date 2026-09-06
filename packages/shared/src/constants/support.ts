import { BRAND_NAME } from './brand.js';

/**
 * Contact support — frame `29 Contact support`, which lives in
 * `design/contact-support/` rather than in `Orla - Screens.dc.html`.
 *
 * The screen is a form that sends **one email** and says so. It is not a
 * helpdesk: no threads, no in-app replies, no ticket status, no attachments,
 * no triage queue. Everything here is the vocabulary both apps read from, so
 * the topic a visitor picks and the topic a human reads in the subject line
 * cannot drift apart.
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
