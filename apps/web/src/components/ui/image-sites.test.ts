import { describe, expect, it } from 'vitest';
import { sourceFiles, TS_AND_TSX, withoutComments } from '@/testing/source-scan';

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
 *
 * **The scan comes from `@/testing/source-scan`, not from a copy.** The first
 * version of this file grew its own tree walk and its own comment stripper, and
 * that stripper reopened the exact hole the helper's docblock records from
 * #395: a naive block-comment rule reads the slash-star inside
 * `'https://*.clerk.accounts.dev'` as a comment opener and deletes everything
 * down to the next closing pair. On `security-headers.ts` that was 138 of 250
 * lines — so an image site written under a wildcard URL would have passed this
 * guard silently. Caught in review, before it shipped.
 */
const SANCTIONED = [
  /* The plain-image adapter: `FallbackImage`, and the tone block itself. */
  'components/ui/fallback-image.tsx',
  /* The `next/image` adapter: local stock and category art. */
  'components/ui/stock-photo.tsx',
  /*
   * The upload zone is the one deliberate exception, and it is narrow.
   *
   * Its image is the *evidence the vendor's own upload arrived* — `onLoad` is
   * what commits the form and the toast — so a silent tone block there would
   * tell a vendor an upload worked. It still has to answer a failed load of an
   * *already saved* photograph, which is not an upload at all; it does, with
   * the drop zone's own empty state, and `image-upload.test.tsx` holds it to
   * that.
   */
  'components/image-upload.tsx',
];

/** A real element, not the word in prose — comments are already blanked. */
const RAW_IMG = /<img[\s/>]/;
const NEXT_IMAGE = /from ['"]next\/image['"]/;

/** `source-scan` names files with the platform separator; the list uses `/`. */
function slashed(name: string): string {
  return name.split('\\').join('/');
}

describe('image render sites', () => {
  it('renders every image through the shared fallback mechanism', async () => {
    const offenders: string[] = [];

    for (const file of await sourceFiles(undefined, TS_AND_TSX)) {
      const name = slashed(file.name);

      if (SANCTIONED.includes(name)) {
        continue;
      }

      if (RAW_IMG.test(file.code)) {
        offenders.push(`${name} — raw image element`);
      }

      if (NEXT_IMAGE.test(file.code)) {
        offenders.push(`${name} — next/image`);
      }
    }

    expect(
      offenders,
      `render these through FallbackImage or StockPhoto (#422):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('scans the tree it claims to scan', async () => {
    /*
     * The guard above passes trivially if the walk returns nothing, and a
     * silently empty scan is how a guard comes to defend nothing. Both halves
     * are asserted: that real files were read, and that the sanctioned list
     * still names files that exist.
     */
    const names = (await sourceFiles(undefined, TS_AND_TSX)).map((file) => slashed(file.name));

    expect(names.length).toBeGreaterThan(100);

    for (const path of SANCTIONED) {
      expect(names, `${path} is sanctioned but no longer exists`).toContain(path);
    }
  });

  it('would fail on a real element, and not on a sentence about one', () => {
    /*
     * The check on the check. A needle taken from the code is usually also in
     * the prose beside it, so both directions are stated — and the third case
     * is the one review caught: a wildcard URL must not swallow the markup
     * under it.
     */
    expect(RAW_IMG.test(withoutComments('<img src="/a.jpg" />'))).toBe(true);
    expect(RAW_IMG.test(withoutComments('/* A plain <img> on a bucket host. */'))).toBe(false);
    expect(RAW_IMG.test(withoutComments('// eslint-disable @next/next/no-img-element'))).toBe(
      false,
    );
    expect(NEXT_IMAGE.test(withoutComments("import Image from 'next/image';"))).toBe(true);
    expect(
      RAW_IMG.test(
        withoutComments("const csp = 'https://*.clerk.accounts.dev';\n<img src='/leaked.jpg' />"),
      ),
      'a wildcard URL swallowed the markup below it — the #395 hole',
    ).toBe(true);
  });
});
