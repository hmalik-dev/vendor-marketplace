import type { LegalAcceptanceDocument } from './legal.js';

/**
 * What each acceptable document **said**, pinned to the bytes that said it.
 *
 * A row in `legal_acceptances` stores a version string, and a version string is
 * a label rather than the text. The copy under `apps/web/content/legal/` is
 * explicitly placeholder that will be replaced, so an edit to `terms.md` that
 * did not bump the version left every existing row attesting to text that no
 * longer exists, with nothing able to reconstruct what was on screen when the
 * person ticked the box. The hash closes that: the version says *which* one, the
 * hash proves *which bytes*.
 *
 * **The hash is of the Markdown source as committed, not of the rendered HTML**
 * (ruled 2026-09-07). Rendering is a function of the renderer, so a Markdown or
 * Tailwind upgrade would move a rendered hash for text nobody edited and every
 * acceptance row would read as drift. The source is what is diffable, what is in
 * version control, and what — rendered by the code at that commit — uniquely
 * determines what the reader saw.
 *
 * **This file is generated. Do not hand-edit it.** `pnpm legal:manifest` writes
 * it from the files themselves, and refuses to record different bytes under a
 * version that is already pinned — so changing a document is a version bump or
 * it is nothing. `apps/web/src/lib/legal-manifest.test.ts` asserts every entry
 * against the file it names, which is what makes an unbumped edit fail
 * `pnpm test` with the document named rather than silently invalidating
 * everybody's record.
 *
 * It lives here rather than beside the documents because both apps read it and
 * the dependency direction is one-way: the API is the writer of the hash, and
 * `apps/api` cannot import from `apps/web`.
 */
export interface LegalDocumentManifestEntry {
  readonly document: LegalAcceptanceDocument;
  /**
   * The version these bytes were pinned under, as a **literal**.
   *
   * Never imported from `CURRENT_*_VERSION`. Importing it would make the
   * manifest agree with the constant by construction — the drift test would
   * compare a value to itself, and the generator would have no way to tell a
   * genuine version bump from a repin under the same name. Written out, the two
   * can disagree, which is exactly what has to be detectable.
   */
  readonly version: string;
  /** Lowercase hex SHA-256 of the Markdown file, as committed. */
  readonly sha256: string;
}

export const LEGAL_DOCUMENT_MANIFEST: readonly LegalDocumentManifestEntry[] = [
  {
    document: 'vendor_agreement',
    version: 'v1.0',
    sha256: 'f32236c9778dc6a20818fe74fb150ee9e7159b2519253b6686185fd6c60249f2',
  },
  {
    document: 'terms_of_service',
    version: 'v1.0',
    sha256: '22881eb55b50491bf58d6e2c427d28a07de72d2daeec5c28a0dda4687501f948',
  },
];

/** How long a hex SHA-256 is, and the only length the column accepts. */
export const LEGAL_DOCUMENT_SHA256_LENGTH = 64;

/**
 * The hash to record on an acceptance of `document`.
 *
 * Throws rather than returning a fallback: a row written with no hash, or with
 * somebody else's, is worse than a failed acceptance — the acceptance can be
 * retried and a wrong record cannot be corrected, because the table refuses
 * updates.
 */
export function legalDocumentSha256(document: LegalAcceptanceDocument): string {
  const entry = LEGAL_DOCUMENT_MANIFEST.find((candidate) => candidate.document === document);

  if (!entry) {
    throw new Error(`legal manifest: no entry for ${document}`);
  }

  return entry.sha256;
}
