import { BRAND_NAME } from '@vendor-marketplace/shared';
import { escapeHtml } from '../../lib/html-escape.js';

/**
 * The Frame 38 shared layout (`design/delta-emails/Orla-Frame-38-Emails.html`,
 * VEN-600): every vendor-invites send — both invite variants and the waitlist
 * confirmation — is this one card with a different headline, body and footer.
 * Kept local to this module rather than merged into
 * `notifications/notification-email.ts`'s `renderHtml`: that template is a
 * narrower single-column card (520px, no brand mark, a different font stack)
 * built for arbitrary notification bodies, and forcing the two to share a
 * helper would either widen every notification email or special-case the
 * brand mark for a sender that does not want it.
 */

const EMAIL_GROUND = '#E9E6DF';
const EMAIL_CARD = '#F8F5EF';
const EMAIL_INK = '#23201C';
const EMAIL_BODY_TEXT = '#4A443C';
const EMAIL_MUTED = '#6B6459';
const EMAIL_BORDER = '#E4DDD1';
const EMAIL_CLAY = '#B4552F';
const EMAIL_ON_CLAY = '#FFFDF9';

const SERIF_STACK = "'Instrument Serif', Georgia, serif";
const SANS_STACK = "'Instrument Sans', Arial, Helvetica, sans-serif";

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Instrument+Sans:wght@400;500;600;700&display=swap';

/** A body paragraph, pre-escaped HTML allowed (e.g. a bolded, escaped address). */
export function paragraph(html: string, topMargin: number): string {
  return `<div style="font-size:14.5px;line-height:1.75;color:${EMAIL_BODY_TEXT};margin-top:${topMargin}px;">${html}</div>`;
}

/** The waitlist confirmation's smaller closing line (Frame 38: 13.5px/1.7, not the 14.5px body size). */
export function smallParagraph(html: string, topMargin: number): string {
  return `<div style="font-size:13.5px;line-height:1.7;color:${EMAIL_BODY_TEXT};margin-top:${topMargin}px;">${html}</div>`;
}

/** An escaped value bolded to `#23201C` — the invitee's address quoted in the sign-up invite. */
export function emphasis(value: string): string {
  return `<span style="font-weight:600;color:${EMAIL_INK};">${escapeHtml(value)}</span>`;
}

/** The one button a Frame 38 email may carry. */
export function button(label: string, href: string): string {
  return [
    '<div style="margin-top:26px;">',
    `<a href="${escapeHtml(href)}" style="display:inline-block;font-family:${SANS_STACK};`,
    `font-size:14px;font-weight:600;line-height:14px;color:${EMAIL_ON_CLAY};background:${EMAIL_CLAY};`,
    'padding:13px 26px;border-radius:10px;text-decoration:none;">',
    `${escapeHtml(label)}</a></div>`,
  ].join('');
}

/** The waitlist confirmation's details box: a 104px label column, `Business` bold. */
export function factBox(facts: ReadonlyArray<[label: string, value: string]>): string {
  const rows = facts
    .map(([label, value], index) => {
      const weight = label === 'Business' ? 600 : 400;
      const topMargin = index === 0 ? 0 : 7;
      return [
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:${topMargin}px;"><tr>`,
        `<td style="width:104px;padding-right:12px;font-size:13.5px;line-height:1.6;color:${EMAIL_MUTED};">${escapeHtml(label)}</td>`,
        `<td style="font-size:13.5px;line-height:1.6;color:${EMAIL_INK};font-weight:${weight};">${escapeHtml(value)}</td>`,
        '</tr></table>',
      ].join('');
    })
    .join('');

  return `<div style="background:${EMAIL_ON_CLAY};border:1px solid ${EMAIL_BORDER};border-radius:12px;padding:16px 18px;margin-top:22px;">${rows}</div>`;
}

/**
 * The card: brand mark, serif headline, the caller's body blocks, footer rule.
 * Table layout with inline styles throughout — email clients strip `<style>`
 * blocks and refuse remote CSS.
 */
export function renderVendorEmailLayout(params: {
  headline: string;
  bodyHtml: string;
  footer: string;
}): string {
  const headline = escapeHtml(params.headline);
  const footer = escapeHtml(params.footer);

  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<link href="${GOOGLE_FONTS_HREF}" rel="stylesheet"></head>`,
    `<body style="margin:0;padding:0;background:${EMAIL_GROUND};">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${EMAIL_GROUND};padding:32px 0;">`,
    '<tr><td align="center">',
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background:${EMAIL_CARD};border-radius:10px;">`,
    `<tr><td style="padding:40px 44px;font-family:${SANS_STACK};">`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;"><tr>',
    '<td style="white-space:nowrap;padding:0;">',
    `<span style="display:inline-block;width:17px;height:17px;border-radius:50%;background:${EMAIL_CLAY};vertical-align:top;"></span>`,
    `<span style="display:inline-block;width:17px;height:17px;border-radius:50%;border:1.3px solid ${EMAIL_INK};vertical-align:top;margin-left:-10px;"></span>`,
    '</td>',
    `<td style="padding-left:9px;font-family:${SERIF_STACK};font-size:24px;color:${EMAIL_INK};">${escapeHtml(BRAND_NAME)}</td>`,
    '</tr></table>',
    `<div style="font-family:${SERIF_STACK};font-size:31px;line-height:1.18;color:${EMAIL_INK};letter-spacing:-.01em;">${headline}</div>`,
    params.bodyHtml,
    `<div style="margin-top:30px;padding-top:20px;border-top:1px solid ${EMAIL_BORDER};font-family:${SANS_STACK};font-size:12px;line-height:1.65;color:${EMAIL_MUTED};">${footer}</div>`,
    '</td></tr></table>',
    '</td></tr></table>',
    '</body></html>',
  ].join('');
}
