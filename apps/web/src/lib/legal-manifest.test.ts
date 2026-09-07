import { createHash } from 'node:crypto';
import {
  CURRENT_TERMS_VERSION,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  LEGAL_ACCEPTANCE_CONTENT,
  LEGAL_ACCEPTANCE_DOCUMENTS,
  LEGAL_DOCUMENT_MANIFEST,
  legalDocumentSha256,
  type LegalAcceptanceDocument,
} from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { legalMarkdownSource } from './legal-content';

/**
 * The drift gate: an edit to a legal document that does not bump its version
 * fails here, naming the document.
 *
 * **This is the whole mechanism of hole 2.** A row in `legal_acceptances`
 * records a version string and the hash of the bytes that version was. The copy
 * under `content/legal/` is explicitly placeholder that will be replaced, so
 * without a check the first replacement would leave every existing acceptance
 * attesting to text that no longer exists — silently, because nothing else in
 * the repository reads those files against anything.
 *
 * It lives in `apps/web` because that is where the documents live, and the
 * manifest lives in `packages/shared` because `apps/api` writes the hash and
 * the dependency direction is one-way. `pnpm legal:manifest` is how a real
 * revision is recorded, and it refuses to repin bytes under a version already
 * pinned.
 */
function sha256Of(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('the legal document manifest', () => {
  it('pins the bytes of every document an account can accept', () => {
    expect(LEGAL_DOCUMENT_MANIFEST.map((entry) => entry.document).sort()).toEqual(
      [...LEGAL_ACCEPTANCE_DOCUMENTS].sort(),
    );
  });

  it.each(LEGAL_ACCEPTANCE_DOCUMENTS)(
    'matches the file %s is served from, or names it',
    (document: LegalAcceptanceDocument) => {
      const slug = LEGAL_ACCEPTANCE_CONTENT[document];
      const actual = sha256Of(legalMarkdownSource(slug));

      expect(
        legalDocumentSha256(document),
        `content/legal/${slug}.md has changed since ${document} was pinned. ` +
          'Every acceptance already recorded attests to the old bytes, so this is a new version: ' +
          'bump its version constant in packages/shared/src/constants/legal.ts, then run ' +
          '`pnpm legal:manifest --version-bumped`.',
      ).toBe(actual);
    },
  );

  /**
   * The hash is of the **source**, not of the rendered HTML (ruled 2026-09-07).
   * Rendering is a function of the renderer, so a Markdown or Tailwind upgrade
   * would move a rendered hash for text nobody edited and every acceptance row
   * would read as drift. Asserted rather than commented, because a future
   * change to hash the rendered output would pass every other test here.
   */
  it('hashes the markdown source rather than anything derived from it', () => {
    const source = legalMarkdownSource('terms');

    expect(legalDocumentSha256('terms_of_service')).toBe(sha256Of(source));
    expect(legalDocumentSha256('terms_of_service')).not.toBe(sha256Of(source.trim()));
  });

  /**
   * A changed file **must** move the hash. Without this the suite above could
   * be satisfied by a constant that happened to match, and the property the
   * column exists for — that different text is a different hash — would be
   * untested.
   */
  it('stops matching the moment the document changes', () => {
    const edited = `${legalMarkdownSource('terms')}\n\nAn added sentence nobody accepted.\n`;

    expect(sha256Of(edited)).not.toBe(legalDocumentSha256('terms_of_service'));
  });

  it('records each document under the version in force for it', () => {
    expect(
      Object.fromEntries(LEGAL_DOCUMENT_MANIFEST.map((entry) => [entry.document, entry.version])),
    ).toEqual({
      terms_of_service: CURRENT_TERMS_VERSION,
      vendor_agreement: CURRENT_VENDOR_AGREEMENT_VERSION,
    });
  });
});
