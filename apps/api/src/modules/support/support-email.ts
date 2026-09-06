import {
  BRAND_NAME,
  SUPPORT_TOPIC_LABELS,
  type SupportErrorContext,
  type SupportTopic,
} from '@vendor-marketplace/shared';
import { escapeHtml } from '../../lib/html-escape.js';

/**
 * The two messages one submission produces, rendered for an inbox.
 *
 * **Two, not one, and the asymmetry is the point.** The message to us is the
 * report and is what decides whether the screen shows `Message sent` or
 * `Try again`. The confirmation to the visitor is a receipt: it repeats the
 * reference so the sent state's promise — "It's in the confirmation email
 * too" — is true, and its failure is logged rather than shown, because by then
 * the visitor already has the reference on screen.
 */

export interface SupportEmailFields {
  reference: string;
  topic: SupportTopic;
  message: string;
  /** Where the reply goes: the account's address, or the one they typed. */
  replyTo: string;
  errorContext?: SupportErrorContext;
  /** Whether the sender proved who they are, which changes how we read it. */
  signedIn: boolean;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Topic first, reference second.
 *
 * A human triages this inbox by eye, so the routing key has to be the part
 * that survives a truncated subject line in a mail client's list view.
 */
export function supportSubject(fields: Pick<SupportEmailFields, 'topic' | 'reference'>): string {
  return `${SUPPORT_TOPIC_LABELS[fields.topic]} · ${fields.reference}`;
}

const WRAPPER_OPEN = [
  '<!doctype html><html><body style="margin:0;padding:24px;background:#F8F5EF;',
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;\">",
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ',
  'style="max-width:520px;margin:0 auto;background:#FFFDF9;border:1px solid #E4DDD1;',
  'border-radius:12px;padding:28px;"><tr><td>',
].join('');

const WRAPPER_CLOSE = '</td></tr></table></body></html>';

/** `ORL-4K7Q-P2` in the mono block the frame draws it in. */
function referenceBlock(reference: string): string {
  return [
    '<p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6B6459;">Reference</p>',
    '<p style="margin:0 0 20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
    `font-size:15px;color:#23201C;">${escapeHtml(reference)}</p>`,
  ].join('');
}

/**
 * A visitor's message runs to several paragraphs, and an inbox that collapses
 * them into one wall is an inbox nobody reads carefully.
 */
function paragraphs(message: string): string {
  return message
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#4A443C;white-space:pre-wrap;">${escapeHtml(block)}</p>`,
    )
    .join('');
}

/** The error reference, when the visitor arrived from the 500 screen. */
function errorBlock(context: SupportErrorContext): string {
  return [
    '<p style="margin:20px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6B6459;">Attached automatically</p>',
    '<p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#23201C;">',
    `${escapeHtml(context.digest)}</p>`,
    `<p style="margin:2px 0 0;font-size:12px;color:#6B6459;">${escapeHtml(context.occurredAt)} · ${escapeHtml(context.route)}</p>`,
  ].join('');
}

/** The plain-text half of the error reference, in the same order. */
function errorLines(context: SupportErrorContext): readonly string[] {
  return ['Attached automatically', context.digest, `${context.occurredAt} · ${context.route}`, ''];
}

/**
 * The report, addressed to whoever reads the support inbox.
 *
 * `signedIn` is stated rather than implied: an address we resolved from an
 * account row is one we can act on, and one a stranger typed into a public form
 * is not — and telling those apart at a glance is the whole of the triage this
 * screen supports.
 */
export function renderSupportReport(fields: SupportEmailFields): RenderedEmail {
  const identity = fields.signedIn
    ? `${fields.replyTo} — signed in`
    : `${fields.replyTo} — signed out, address not verified`;

  const html = [
    WRAPPER_OPEN,
    `<p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6B6459;">${escapeHtml(BRAND_NAME)} support</p>`,
    `<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#23201C;">${escapeHtml(SUPPORT_TOPIC_LABELS[fields.topic])}</h1>`,
    referenceBlock(fields.reference),
    `<p style="margin:0 0 16px;font-size:13px;color:#6B6459;">From ${escapeHtml(identity)}</p>`,
    paragraphs(fields.message),
    fields.errorContext ? errorBlock(fields.errorContext) : '',
    WRAPPER_CLOSE,
  ].join('');

  const text = [
    `${BRAND_NAME} support`,
    SUPPORT_TOPIC_LABELS[fields.topic],
    `Reference ${fields.reference}`,
    `From ${identity}`,
    '',
    fields.message,
    '',
    ...(fields.errorContext ? errorLines(fields.errorContext) : []),
  ].join('\n');

  return { subject: supportSubject(fields), html, text };
}

/**
 * The receipt, addressed to the visitor.
 *
 * It says what will happen and what will not: an answer arrives by email, and
 * there is nothing on the site to come back and check. The screen says the
 * same, and both exist so nobody returns looking for a status this product
 * deliberately does not keep.
 */
export function renderSupportConfirmation(fields: SupportEmailFields): RenderedEmail {
  const subject = `We got your message · ${fields.reference}`;

  /*
   * **The echo is only ever sent to an address we resolved from an account.**
   *
   * A signed-out caller chooses this recipient, and echoing their own 4,000
   * characters back to it turns the route into a content-controlled relay:
   * anyone could send DKIM-signed, ${BRAND_NAME}-branded mail carrying text of
   * their choosing to a stranger who never used the product, under a heading
   * saying we had received something from them. The rate limit bounds the
   * volume of that and not the content.
   *
   * Nothing is lost by withholding it. The screen's promise is that the
   * reference is in this email, and the reference is here either way — the
   * design asks for nothing more (frame `29`, state 5). A signed-in sender
   * still gets their copy, because that address is one the account proved.
   */
  const echo = fields.signedIn;

  const html = [
    WRAPPER_OPEN,
    `<p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6B6459;">${escapeHtml(BRAND_NAME)}</p>`,
    '<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#23201C;">We got your message</h1>',
    '<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#4A443C;">',
    "We'll reply to this address, usually within one business day. There's nothing to check back on &mdash; the answer comes to your inbox.</p>",
    referenceBlock(fields.reference),
    '<p style="margin:0 0 12px;font-size:13px;color:#6B6459;">Quote this if you follow up.',
    echo ? ' Here is what you sent:</p>' : '</p>',
    echo ? paragraphs(fields.message) : '',
    WRAPPER_CLOSE,
  ].join('');

  const text = [
    BRAND_NAME,
    'We got your message',
    '',
    "We'll reply to this address, usually within one business day. There's nothing to check back on — the answer comes to your inbox.",
    '',
    `Reference ${fields.reference}`,
    echo ? 'Quote this if you follow up. Here is what you sent:' : 'Quote this if you follow up.',
    ...(echo ? ['', fields.message] : []),
  ].join('\n');

  return { subject, html, text };
}
