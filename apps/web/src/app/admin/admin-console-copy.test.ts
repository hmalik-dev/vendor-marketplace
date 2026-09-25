import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * VEN-736 and VEN-737: the admin console's lists, details, filters, actions,
 * confirm dialogs and audit labels read short and in US English. A sentence
 * says one fact; a clause that only justifies or reassures it is cut. This
 * scans the console's own sources, comments removed and whitespace collapsed
 * (prettier wraps JSX text, so a tail can straddle two lines), for the tails
 * the copy audit cut.
 */

const WEB_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SURFACE_DIRS = ['app/admin', 'components/admin'];

const TAILS =
  /\b(?:so that|which means|rather than|so you can|is worth|is what (?:lets|puts|convinces)|confirms first)\b|[,—] so (?:this|nothing|there is|no payout|rule|it could|confirm|they)\b/gi;

/**
 * "Cancelled" as a word a reader sees, quoted labels included. The exact
 * `'cancelled'` status value, the `cancelled_by` column and a property read
 * are code and stay.
 */
const BRITISH_CANCEL = /(?<![\w.$/-])(?<!['"`](?=cancelled['"`]))[Cc]ancell(?:ed|ing)(?![\w$])/g;

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) return sourcesUnder(full);

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Whole-line `//` comments, block comments (JSX ones included), and `*` lines, then one space per run of whitespace. */
function readable(source: string): string {
  return source
    .split('\n')
    .map((line) => (line.trimStart().startsWith('//') ? '' : line))
    .join('\n')
    .replace(/(^|[\s{(;,])\/\*[\s\S]*?\*\//g, '$1')
    .split('\n')
    .map((line) => (line.trimStart().startsWith('*') ? '' : line))
    .join('\n')
    .replace(/\s+/g, ' ');
}

const files = SURFACE_DIRS.flatMap((dir) => sourcesUnder(path.join(WEB_SRC, dir))).map((file) => ({
  relative: path.relative(WEB_SRC, file),
  text: readable(readFileSync(file, 'utf8')),
}));

function tailsIn(relative: string, text: string, pattern: RegExp = TAILS): string[] {
  return [...text.matchAll(pattern)].map((match) => `${relative}: ${match[0]}`);
}

function source(relative: string): string {
  return files.find((file) => file.relative === relative)?.text ?? '';
}

describe('admin console copy', () => {
  it('reads the whole surface, so an empty sweep cannot pass', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(source('components/admin/pager.tsx')).toContain('Past the last page');
  });

  it('finds a tail in code, across a wrapped line, and ignores one in a comment', () => {
    const code =
      '<p>\n  Approved tags become filters, so the queue is\n  worth keeping short.\n</p>';
    const dashed = "'Another account holds it — so it could not be written.'";
    const comments = '/* rather than */\n// which means\n{/* so that */}';

    expect(tailsIn('x.tsx', readable(code))).toEqual(['x.tsx: is worth']);
    expect(tailsIn('x.tsx', readable(dashed))).toEqual(['x.tsx: — so it could']);
    expect(tailsIn('x.tsx', readable(comments))).toEqual([]);
  });

  it('carries no justifying tail in a string an admin reads', () => {
    expect(files.flatMap((file) => tailsIn(file.relative, file.text))).toEqual([]);
  });

  it('tells the word from the status value and the column', () => {
    const code =
      "<p>The booking is cancelled.</p> status === 'cancelled' <span>cancelled_by</span> row.cancelled label=\"Cancelled by\" 'Cancelled bookings'";

    expect(tailsIn('x.tsx', readable(code), BRITISH_CANCEL)).toEqual([
      'x.tsx: cancelled',
      'x.tsx: Cancelled',
      'x.tsx: Cancelled',
    ]);
  });

  it('spells canceled the US way in a string an admin reads', () => {
    expect(files.flatMap((file) => tailsIn(file.relative, file.text, BRITISH_CANCEL))).toEqual([]);
  });

  it('pins the rewritten lines', () => {
    expect(source('components/admin/tag-queue.tsx')).toContain(
      'Vendors suggest a tag when the list does not describe them. Approved tags become search filters."',
    );
    expect(source('app/admin/cases/[caseId]/page.tsx')).toContain(
      'The network&apos;s answer does not resolve the case. Rule on it in region 3.',
    );
    expect(source('app/admin/cases/[caseId]/page.tsx')).toContain(
      "'No booking was named. No payout was held.'",
    );
    expect(source('app/admin/users/[userId]/page.tsx')).toContain(
      'Free the address on the other account to let the next profile change through.',
    );
    expect(source('components/admin/payout-health-alert.tsx')).toContain(
      'The scheduled release keeps trying. This clears once the accounts are in order.',
    );
    expect(source('components/admin/platform-settings-panel.tsx')).toContain(
      "'Only an invited email can open a vendor account. Anyone else is sent to the application form. Customers sign up as usual.'",
    );
    expect(source('components/admin/activity-table.tsx')).toContain(
      "'Clear the filter to see all activity.'",
    );
  });

  it('pins the rewritten action and dialog lines (VEN-737)', () => {
    expect(source('components/admin/vendor-detail-actions.tsx')).toContain(
      'This account is closed and its bookings were unwound. There is nothing to publish, hold or suspend.',
    );
    expect(source('components/admin/vendor-table.tsx')).toContain(
      "'They can sign in again at once. Their storefront stays unpublished until they publish it. Bookings the suspension canceled are not restored.'",
    );
    expect(source('components/admin/data-rights-actions.tsx')).toContain(
      '<strong className="font-semibold">Can&apos;t close: this is your own account.</strong> ) : (',
    );
    expect(source('components/admin/case-resolution.tsx')).toContain(
      "'This booking is not on hold. There is no payout to move. Closing the case records it as handled.'",
    );
    expect(source('components/admin/payment-table.tsx')).toContain(
      'The scheduled release keeps retrying either way.',
    );
    expect(source('components/admin/step-up-panel.tsx')).toContain(
      `"This can't be undone. Confirm it's you first."`,
    );
    expect(source('components/admin/tag-queue.tsx')).toContain(
      'description="The note stays on the queue. The vendor is not notified."',
    );
  });
});
