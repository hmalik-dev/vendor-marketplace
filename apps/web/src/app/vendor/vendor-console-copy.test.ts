import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * VEN-735: the vendor console reads warm, short and in US English. A sentence
 * says one fact; a clause that only justifies or reassures it is cut. This scans
 * the console's own sources, comments removed and whitespace collapsed (prettier
 * wraps JSX text, so a tail can straddle two lines), for the tails the copy
 * audit cut.
 */

const WEB_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SURFACE_DIRS = [
  'app/vendor',
  'components/vendor',
  'components/packages',
  'components/portfolio',
  'components/availability',
  'components/uploads',
];
const SURFACE_FILES = [
  'components/vendor-profile-form.tsx',
  'components/vendor-nav.tsx',
  'components/vendor-surface.tsx',
  'components/image-upload.tsx',
];

const TAILS =
  /\b(?:so that|which means|rather than|which is worth naming|so you can|is what (?:lets|puts|convinces))\b/gi;

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

const files = [
  ...SURFACE_DIRS.flatMap((dir) => sourcesUnder(path.join(WEB_SRC, dir))),
  ...SURFACE_FILES.map((file) => path.join(WEB_SRC, file)),
].map((file) => ({
  relative: path.relative(WEB_SRC, file),
  text: readable(readFileSync(file, 'utf8')),
}));

function tailsIn(relative: string, text: string): string[] {
  return [...text.matchAll(TAILS)].map((match) => `${relative}: ${match[0]}`);
}

function source(relative: string): string {
  return files.find((file) => file.relative === relative)?.text ?? '';
}

describe('vendor console copy', () => {
  it('reads the whole surface, so an empty sweep cannot pass', () => {
    expect(files.length).toBeGreaterThan(35);
    expect(source('app/vendor/payments/page.tsx')).toContain('Payouts not connected');
  });

  it('finds a tail in code, across a wrapped line, and ignores one in a comment', () => {
    const code =
      "<p>\n  It adds a row rather\n  than replacing one.\n</p>\n'Paid, so that you know.'";
    const comments = '/* rather than */\n// which means\n{/* so that */}';

    expect(tailsIn('x.tsx', readable(code))).toEqual(['x.tsx: rather than', 'x.tsx: so that']);
    expect(tailsIn('x.tsx', readable(comments))).toEqual([]);
  });

  it('carries no justifying tail in a string a vendor reads', () => {
    expect(files.flatMap((file) => tailsIn(file.relative, file.text))).toEqual([]);
  });

  it('pins the rewritten lines', () => {
    expect(source('app/vendor/payments/page.tsx')).toContain(
      'Connect your bank account to accept bookings.',
    );
    expect(source('app/vendor/payments/page.tsx')).toContain(
      'Stripe asks for your bank details and ID.',
    );
    expect(source('app/vendor/dashboard/page.tsx')).toContain(
      'Keep your calendar current to show up in search.',
    );
    expect(source('components/vendor/vendor-agreement-screen.tsx')).toContain(
      'Accept this agreement to take payments.',
    );
    expect(source('components/vendor/vendor-agreement-screen.tsx')).toContain(
      'What you have accepted, and when. Each new version adds a row.',
    );
    expect(source('components/vendor/request-row.tsx')).toContain(
      'You can&apos;t undo this. If you&apos;re unsure, send a quote or message them.',
    );
    expect(source('components/vendor/request-row.tsx')).toContain(
      "`They asked about ${date}. We'll tell them the date is free again.`",
    );
    expect(source('components/availability/availability-calendar.tsx')).toContain(
      "'Pick future dates that are not booked.'",
    );
    expect(source('components/vendor/cancel-booking.tsx')).toContain("'Canceling…'");
    expect(source('components/portfolio/portfolio-manager.tsx')).toContain(
      'No photos yet. Add eight to twelve of your best.',
    );
    expect(source('components/packages/package-manager.tsx')).toContain(
      'Your profile comes off the marketplace until a package is bookable again.',
    );
  });
});
