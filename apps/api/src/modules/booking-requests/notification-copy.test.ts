import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Frame `08/09/11 shared`, Text axis.
 *
 * The sweep found a notification reading "A customer asked about 2026-12-19.
 * You have a week to reply." — a stored value leaking into copy, the same
 * class of defect as rendering a row id.
 *
 * Re-measuring in the current app found the copy already formatted: all three
 * notification bodies route their date through `readableDate`. This file is
 * the regression guard that keeps it that way, since the defect can come back
 * with a single new template.
 *
 * Note on provenance: unlike the other findings on this frame, the expected
 * string cannot be read out of `Orla - Screens.dc.html` — the bundle never
 * draws the vendor notification panel, so there is no frame literal to compare
 * against. What the frames do establish is that dates are written for a reader
 * ("Sun, Jun 14"), never as ISO, and that is what is asserted here.
 */
const service = readFileSync(join(import.meta.dirname, 'booking-requests.service.ts'), 'utf8');

/** Every notification string the service builds. */
const COPY = /(?:title|body):\s*`([^`]*)`/g;

function copyTemplates(): string[] {
  return [...service.matchAll(COPY)].map((match) => match[1] ?? '');
}

describe('notification copy never carries a raw ISO date', () => {
  it('the service builds the copy this test measures', () => {
    const templates = copyTemplates();

    // Guards the guard: a regex that matched nothing would pass everything.
    expect(templates.length).toBeGreaterThan(0);

    // At least one template must interpolate a date, or the assertions below
    // are vacuous. The wording itself is not pinned — a copy rewrite is not a
    // regression in date formatting.
    expect(templates.some((template) => /\$\{readableDate\(/.test(template))).toBe(true);
  });

  it('interpolates no date field directly', () => {
    for (const template of copyTemplates()) {
      /*
       * A *bare* member expression only: `${row.eventDate}` is the shape that
       * produced 2026-12-19, while `${readableDate(row.eventDate)}` names the
       * same field and is exactly what this file wants to see.
       */
      expect(template).not.toMatch(
        /\$\{\s*[A-Za-z_$][\w$]*\.(?:eventDate|createdAt|updatedAt)\s*\}/,
      );
    }
  });

  it('routes every date it does show through the formatter', () => {
    const dated = copyTemplates().filter((template) => /\$\{[^}]*[Dd]ate[^}]*\}/.test(template));

    expect(dated.length).toBeGreaterThan(0);

    for (const template of dated) {
      expect(template).toMatch(/\$\{readableDate\(/);
    }
  });

  /*
   * A raw producer, not only a raw field.
   *
   * The bans above match `${row.eventDate}` and interpolations whose text
   * contains "date". `lastReplyDay` returns a bare `YYYY-MM-DD` and its name
   * contains neither, so `${lastReplyDay(row.expiresAt, now)}` written without
   * the formatter would emit `2026-09-08` past every other assertion here.
   */
  it('wraps the reply-day producer in the formatter', () => {
    for (const template of copyTemplates()) {
      expect(template).not.toMatch(/\$\{\s*lastReplyDay\s*\(/);
    }
  });

  /*
   * The deadline is per-row since #401, so no notification may state it as a
   * length. Both strings that ticket had to correct — "You have 7 days to
   * reply" and "It went unanswered for a week" — were in this file's own reach
   * and no assertion here saw them; `one-deadline-one-fee.test.ts` holds the
   * same line but only scans `apps/web/src`, and the regression was in the API.
   */
  it('states no reply window as a duration', () => {
    for (const template of copyTemplates()) {
      expect(template).not.toMatch(/\b\d+ days?\b/);
      expect(template).not.toMatch(/\ba week\b/i);
    }
  });

  it('hard-codes no ISO date in any template', () => {
    for (const template of copyTemplates()) {
      expect(template).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  /*
   * The formatter is what makes the difference visible, so its shape is
   * asserted rather than assumed: a named month cannot render as `2026-12-19`.
   */
  it('formats with a named month and a numeric day', () => {
    const formatter = service.match(/new Intl\.DateTimeFormat\(\s*'en-US',\s*\{([^}]*)\}/);

    expect(formatter).not.toBeNull();

    const options = formatter?.[1] ?? '';
    expect(options).toMatch(/month:\s*'(?:long|short)'/);
    expect(options).toMatch(/day:\s*'numeric'/);
    // A date-only column read in local time slides a day either way.
    expect(options).toMatch(/timeZone:\s*'UTC'/);
  });
});
