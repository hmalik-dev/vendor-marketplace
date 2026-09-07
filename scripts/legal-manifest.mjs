#!/usr/bin/env node
/**
 * Regenerates `packages/shared/src/constants/legal-manifest.ts` from the legal
 * Markdown that the pages and the vendor agreement step actually render.
 *
 * **It refuses to record different bytes under a version that is already
 * pinned.** That refusal is the whole mechanism. Editing `terms.md` without
 * bumping `CURRENT_TERMS_VERSION` would otherwise let a regenerate quietly
 * repoint every existing acceptance row at text nobody accepted — and the row
 * cannot be corrected afterwards, because the table refuses updates. So the
 * only two outcomes are "the bytes match what is pinned" and "you bumped the
 * version".
 *
 * The refusal is **checked, not asserted by the operator**: the pinned version
 * is a literal in the manifest and the version in force is a constant in
 * `legal.ts`, so this compares them rather than taking a `--i-bumped-it` flag's
 * word for it.
 *
 * Run it with `pnpm legal:manifest`, which builds `@vendor-marketplace/shared`
 * first so the document list and the versions are read from the same constants
 * the application uses rather than a second copy kept in step by hand.
 * `apps/web/src/lib/legal-manifest.test.ts` is the gate; this is the way to
 * satisfy it.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'apps', 'web', 'content', 'legal');
const SHARED = path.join(ROOT, 'packages', 'shared');
const MANIFEST_FILE = path.join(SHARED, 'src', 'constants', 'legal-manifest.ts');

const {
  CURRENT_TERMS_VERSION,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  LEGAL_ACCEPTANCE_CONTENT,
  LEGAL_DOCUMENT_MANIFEST,
} = await import(path.join(SHARED, 'dist', 'index.js'));

/**
 * The version in force for each acceptable document.
 *
 * `LEGAL_ACCEPTANCE_CONTENT` supplies the document → file mapping, so a third
 * acceptable document is one entry in `legal.ts` plus one line here rather than
 * a second table this script keeps privately.
 */
const VERSION_IN_FORCE = {
  terms_of_service: CURRENT_TERMS_VERSION,
  vendor_agreement: CURRENT_VENDOR_AGREEMENT_VERSION,
};

export function sha256OfFile(file) {
  return createHash('sha256').update(readFileSync(file, 'utf8'), 'utf8').digest('hex');
}

/** The manifest source, rendered whole — the file declares itself generated. */
export function renderManifest(entries, header) {
  const rows = entries
    .map(
      ({ document, version, sha256 }) =>
        `  {\n    document: '${document}',\n    version: '${version}',\n    sha256: '${sha256}',\n  },`,
    )
    .join('\n');

  return `${header}export const LEGAL_DOCUMENT_MANIFEST: readonly LegalDocumentManifestEntry[] = [\n${rows}\n];\n`;
}

function main() {
  const source = readFileSync(MANIFEST_FILE, 'utf8');
  const marker = 'export const LEGAL_DOCUMENT_MANIFEST';
  const tail = source.indexOf(marker);
  const closing = source.indexOf('\n];\n', tail);

  if (tail === -1 || closing === -1) {
    process.stderr.write(`legal:manifest cannot find the manifest array in ${MANIFEST_FILE}\n`);
    process.exitCode = 1;
    return;
  }

  const entries = [];

  for (const [document, slug] of Object.entries(LEGAL_ACCEPTANCE_CONTENT)) {
    const inForce = VERSION_IN_FORCE[document];

    if (!inForce) {
      process.stderr.write(
        `legal:manifest has no version constant for ${document}. Add one to VERSION_IN_FORCE.\n`,
      );
      process.exitCode = 1;
      return;
    }

    const sha256 = sha256OfFile(path.join(CONTENT_DIR, `${slug}.md`));
    const pinned = LEGAL_DOCUMENT_MANIFEST.find((entry) => entry.document === document);

    if (pinned && pinned.sha256 !== sha256 && pinned.version === inForce) {
      process.stderr.write(
        `legal:manifest refuses to repin ${document} (${slug}.md).\n` +
          `Its bytes changed while its version stayed ${inForce}, which means every existing acceptance of it attests to text that no longer exists.\n` +
          `Bump its version constant in packages/shared/src/constants/legal.ts, rebuild shared, then re-run.\n`,
      );
      process.exitCode = 1;
      return;
    }

    entries.push({ document, version: inForce, sha256 });
  }

  const next =
    renderManifest(entries, source.slice(0, tail)) + source.slice(closing + '\n];\n'.length);

  if (next === source) {
    process.stdout.write('legal:manifest is up to date.\n');
    return;
  }

  writeFileSync(MANIFEST_FILE, next);
  for (const { document, version, sha256 } of entries) {
    process.stdout.write(`legal:manifest pinned ${document} ${version} to ${sha256}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
