import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Acceptance 5 of #422: **one shared mechanism, and a new image site inherits
 * it without opting in.**
 *
 * That cannot be true of a convention nobody enforces — the whole ticket exists
 * because ten call sites each had to remember a fallback and none of them did.
 * So the rule is structural: every image in the web app is rendered by one of
 * the three files below, and any other `<img>` or `next/image` fails here.
 *
 * The two rendering paths are deliberately separate adapters over one
 * mechanism (`useImageFailure` + `ImageFallback`), because `next/image` and a
 * plain `<img>` genuinely differ — bucket content skips `next/image` since the
 * host changes between environments.
 */
const SANCTIONED = [
  /* The plain-`<img>` adapter: `FallbackImage`, and the tone block itself. */
  'src/components/ui/fallback-image.tsx',
  /* The `next/image` adapter: local stock and category art. */
  'src/components/ui/stock-photo.tsx',
  /*
   * The upload zone is the one deliberate exception, and it is not an
   * omission. Its `<img>` is the *evidence the vendor's own upload arrived* —
   * `onLoad` is what commits the form and the toast, and its `onError` already
   * reports the upload as failed and keeps the previous photo. Replacing that
   * with a silent tone block would tell a vendor their upload worked. This is
   * an editor surface, not a page a customer reads.
   */
  'src/components/image-upload.tsx',
];

const WEB_SRC = join(process.cwd(), 'src');

/**
 * Comments are stripped before scanning, because several of these files
 * *describe* the `<img>` they render ("A plain <img>: user uploads on an origin
 * that changes...") and a guard that matches its own prose can never fail —
 * the failure mode `web-design-parity.md` records as a check that is not one.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .join('\n');
}

function sourceFiles(directory = WEB_SRC, prefix = ''): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      found.push(...sourceFiles(join(directory, entry.name), relativePath));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(relativePath);
    }
  }

  return found.sort();
}

describe('image render sites', () => {
  it('renders every image through the shared fallback mechanism', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const path = `src/${file}`;

      if (SANCTIONED.includes(path)) {
        continue;
      }

      const source = withoutComments(readFileSync(join(WEB_SRC, file), 'utf8'));

      if (/<img[\s/>]/.test(source)) {
        offenders.push(`${path} — raw <img>`);
      }

      if (/from ['"]next\/image['"]/.test(source)) {
        offenders.push(`${path} — next/image`);
      }
    }

    expect(
      offenders,
      `render these through FallbackImage or StockPhoto (#422):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('scans the tree it claims to scan', () => {
    /*
     * The guard above passes trivially if the glob returns nothing, and a
     * silently empty scan is exactly how a guard comes to defend nothing. Both
     * halves are asserted: that real files were read, and that the sanctioned
     * list still names files that exist.
     */
    const files = sourceFiles();

    expect(files.length).toBeGreaterThan(100);

    for (const path of SANCTIONED) {
      expect(files, `${path} is sanctioned but no longer exists`).toContain(
        path.replace(/^src\//, ''),
      );
    }
  });

  it('would fail on a raw <img>, comment or not', () => {
    /*
     * The check on the check. A needle taken from the code is usually also in
     * the prose beside it, so this states both directions explicitly: real
     * markup is caught, and a sentence describing it is not.
     */
    expect(/<img[\s/>]/.test(withoutComments('<img src="/a.jpg" />'))).toBe(true);
    expect(/<img[\s/>]/.test(withoutComments('/* A plain <img> on a bucket host. */'))).toBe(false);
    expect(/<img[\s/>]/.test(withoutComments('// eslint-disable @next/next/no-img-element'))).toBe(
      false,
    );
    expect(
      /from ['"]next\/image['"]/.test(withoutComments("import Image from 'next/image';")),
    ).toBe(true);
  });
});
