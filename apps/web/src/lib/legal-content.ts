import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LEGAL_CONTENT_SLUGS,
  type LegalContentSlug,
  type LegalDocumentSlug,
} from '@vendor-marketplace/shared';
import { parseLegalMarkdown, type LegalDocument } from './legal-markdown';

/**
 * Where the legal copy lives, and why it lives in a file rather than in JSX.
 *
 * **The copy is placeholder and is meant to be replaced.** Frame `31`'s prose
 * is written to the right length and register, and every factual claim in it is
 * true of this codebase, but none of it is reviewed legal text. Keeping it in
 * `content/legal/*.md` means replacing it is an edit to a Markdown file by
 * somebody who has never opened this repository — and the last-updated date
 * moves with it, because the page reads the frontmatter.
 *
 * Read from disk at module scope rather than imported, because Next and Vitest
 * disagree about what `?raw` means and neither of them needs to: these three
 * pages are statically rendered, so the read happens once at build time.
 * `outputFileTracingIncludes` in `next.config.ts` is what carries the directory
 * into the deployment bundle.
 */
const CONTENT_DIR = path.join(process.cwd(), 'content', 'legal');

function read(slug: LegalContentSlug): LegalDocument {
  const file = path.join(CONTENT_DIR, `${slug}.md`);

  try {
    return parseLegalMarkdown(slug, readFileSync(file, 'utf8'));
  } catch (cause) {
    /*
     * Loud, and at build time. A legal page that renders empty because its file
     * moved is worse than a failed build: the footer still links to it, Stripe
     * Connect onboarding still asks for the URL, and nothing says the page is
     * blank until somebody opens it.
     */
    throw new Error(`legal content: cannot load ${file}`, { cause });
  }
}

/** Every legal document, parsed once. Keyed so a caller reads one by slug. */
const DOCUMENTS: Record<LegalContentSlug, LegalDocument> = Object.fromEntries(
  LEGAL_CONTENT_SLUGS.map((slug) => [slug, read(slug)]),
) as Record<LegalContentSlug, LegalDocument>;

/** One of the three routed reading pages. */
export function legalDocument(slug: LegalDocumentSlug): LegalDocument {
  return DOCUMENTS[slug];
}

/**
 * The vendor agreement, which is a document without a page: it is read inside
 * step 3 of onboarding, clipped and expandable in place.
 */
export function vendorAgreementDocument(): LegalDocument {
  return DOCUMENTS['vendor-agreement'];
}

/** The raw markdown, for the guards that read what was written rather than rendered. */
export function legalMarkdownSource(slug: LegalContentSlug): string {
  return readFileSync(path.join(CONTENT_DIR, `${slug}.md`), 'utf8');
}
