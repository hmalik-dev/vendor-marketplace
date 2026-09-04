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

describe('structured data written straight into the DOM', () => {
  const files = sourceFiles(SOURCE_ROOT).map(
    (file) => [file.replace(`${SOURCE_ROOT}/`, ''), readFileSync(file, 'utf8')] as const,
  );

  it('finds the sites it is meant to be guarding', () => {
    const withRawHtml = files.filter(([, code]) => code.includes('dangerouslySetInnerHTML'));

    // A scan that matched nothing would pass forever while the rule went
    // unenforced. Both known sites are JSON-LD blocks.
    expect(withRawHtml.map(([file]) => file).sort()).toEqual([
      'app/page.tsx',
      'app/vendors/[slug]/page.tsx',
    ]);
  });

  it('never hands raw JSON.stringify to dangerouslySetInnerHTML', () => {
    const offenders = files
      .filter(([, code]) => /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/.test(code))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it('serialises every JSON-LD block through the escaping helper', () => {
    const offenders = files
      .filter(([, code]) => code.includes('application/ld+json'))
      .filter(([, code]) => !code.includes('serialiseJsonLd'))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });
});
