import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * #398 — stored XSS through JSON-LD.
 *
 * `JSON.stringify` escapes what JSON needs and nothing HTML needs. JSON-LD can
 * only reach a page through `dangerouslySetInnerHTML`, where React's escaping
 * does not apply — so a vendor whose business name contained
 * `</script><script>alert(1)</script>` closed the element and opened a second
 * one, on the most-visited public page in the product.
 *
 * The fix is `serialiseJsonLd` in `@vendor-marketplace/shared`, which has its
 * own unit tests. This is the half that closes the class: a third block of
 * structured data added later would otherwise reintroduce it in a file nobody
 * re-reads, and the two existing sites both carried a comment asserting the
 * payload was trusted.
 */

const SOURCE_ROOT = join(process.cwd(), 'src');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);

    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }

    return /\.tsx?$/.test(entry) && !entry.includes('.test.') ? [full] : [];
  });
}

const JSON_LD_BLOCK = /type="application\/ld\+json"/g;

describe('structured data written straight into the DOM', () => {
  const files = sourceFiles(SOURCE_ROOT).map(
    (file) => [file.replace(`${SOURCE_ROOT}/`, ''), readFileSync(file, 'utf8')] as const,
  );

  /**
   * Counted per file, not `.includes`/whole-file `.test`: a file that guards
   * its first JSON-LD block would otherwise hide a second, unguarded one
   * added beside it. This compares two whole-file totals rather than pairing
   * a guard to its block, so `guarded < blocks` (not `!==`) — a legitimately
   * guarded block may spend the guard token more than once (e.g. composing a
   * script's payload from two `serialiseJsonLd(...)` calls), and that must
   * not read as an offence.
   */
  function filesMissingGuard(
    entries: readonly (readonly [string, string])[],
    guardPattern: RegExp,
  ): string[] {
    return entries
      .filter(([, code]) => {
        const blocks = code.match(JSON_LD_BLOCK)?.length ?? 0;
        const guarded = code.match(guardPattern)?.length ?? 0;

        return blocks > 0 && guarded < blocks;
      })
      .map(([file]) => file);
  }

  it('finds the sites it is meant to be guarding', () => {
    const withRawHtml = files.filter(([, code]) => code.includes('dangerouslySetInnerHTML'));

    // A scan that matched nothing would pass forever while the rule went
    // unenforced. Both known sites are JSON-LD blocks.
    expect(withRawHtml.map(([file]) => file).sort()).toEqual([
      'app/page.tsx',
      'app/vendors/[slug]/(profile)/page.tsx',
    ]);
  });

  it('never hands raw JSON.stringify to dangerouslySetInnerHTML', () => {
    const offenders = files
      .filter(([, code]) => /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/.test(code))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  /*
   * VEN-523: script-src has no `unsafe-inline`, so a JSON-LD block without the
   * request's nonce is blocked in production and the page loses its structured
   * data. A JSX attribute check: the rendered result is a browser check.
   */
  it('stamps every JSON-LD block with the request nonce', () => {
    const NONCE_PATTERN = /type="application\/ld\+json"\s+nonce=\{nonce\}/g;
    const offenders = filesMissingGuard(files, NONCE_PATTERN);

    expect(offenders).toEqual([]);

    // A second, unguarded block beside a conforming one is not hidden by it.
    const secondBlockUnnonced: readonly [string, string] = [
      'synthetic.tsx',
      `
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: serialiseJsonLd(a) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiseJsonLd(b) }} />
      `,
    ];

    expect(filesMissingGuard([secondBlockUnnonced], NONCE_PATTERN)).toEqual(['synthetic.tsx']);
  });

  it('serialises every JSON-LD block through the escaping helper', () => {
    const HELPER_PATTERN = /serialiseJsonLd\(/g;
    const offenders = filesMissingGuard(files, HELPER_PATTERN);

    expect(offenders).toEqual([]);

    // A second block that falls back to JSON.stringify is not hidden by a
    // conforming first block.
    const secondBlockUnserialised: readonly [string, string] = [
      'synthetic.tsx',
      `
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: serialiseJsonLd(a) }} />
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(b) }} />
      `,
    ];

    expect(filesMissingGuard([secondBlockUnserialised], HELPER_PATTERN)).toEqual(['synthetic.tsx']);

    // A block whose payload composes two calls to the helper is guarded, not
    // an offender — `guarded < blocks`, never `!==`.
    const oneBlockTwoHelperCalls: readonly [string, string] = [
      'synthetic-composed.tsx',
      `
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: serialiseJsonLd(a) + serialiseJsonLd(b) }} />
      `,
    ];

    expect(filesMissingGuard([oneBlockTwoHelperCalls], HELPER_PATTERN)).toEqual([]);
  });

  /*
   * VEN-578: the browser hides a `<script>` node's `nonce` content attribute
   * (`getAttribute` reads back "") once it is in the document, so hydration
   * always sees a mismatch against the real value React rendered server-side.
   * `suppressHydrationWarning` is what tells React that divergence is expected.
   *
   * Counted per file, not `.includes`: a file that already carries one
   * suppressed block would otherwise hide a second, unsuppressed one added
   * beside it.
   */
  it("suppresses the hydration warning every JSON-LD block's nonce provokes", () => {
    const offenders = filesMissingGuard(files, /suppressHydrationWarning/g);

    expect(offenders).toEqual([]);
  });
});
