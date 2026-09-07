import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reading a design frame, for the guards that pin a number to the markup that
 * draws it rather than restating it.
 *
 * `.claude/rules/web-design-parity.md` asks for exactly that — a measurement is
 * read back out of the frame so the code and the contract cannot drift apart in
 * silence — and #441 was about to add its second byte-identical copy of the
 * loader that does it. `source-scan.ts` exists for the same reason one module
 * earlier, and says so in its own header.
 *
 * A **delta bundle** is a directory under `design/` holding one or more frames
 * revised after the screens document was cut. `design/delta-band/` holds the
 * closing band and the site footer; `design/delta-legal/` holds the reading
 * layout.
 */

/** The repository root — `apps/web/src` is three directories down from it. */
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

/**
 * The frames in one delta bundle, in directory order.
 *
 * Found by directory rather than by filename: the names carry the product name,
 * and `brand-literals.test.ts` forbids that literal anywhere under
 * `apps/web/src`.
 */
function deltaFrames(bundle: string): string[] {
  const directory = path.join(REPO_ROOT, 'design', bundle);

  return readdirSync(directory)
    .filter((entry) => entry.endsWith('.html'))
    .map((entry) => readFileSync(path.join(directory, entry), 'utf8'));
}

/**
 * The single frame in a one-frame bundle.
 *
 * Throws rather than taking the first of several, because "whichever the
 * directory happens to list first" is not a design contract — a second frame
 * landing in the bundle is a question for a reader, not a silent change of
 * which markup a guard is measuring.
 */
export function deltaFrame(bundle: string): string {
  const frames = deltaFrames(bundle);

  if (frames.length !== 1) {
    throw new Error(`design/${bundle} holds ${frames.length} frames, expected exactly one`);
  }

  return frames[0] as string;
}
