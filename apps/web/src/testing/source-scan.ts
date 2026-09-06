import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reading `apps/web`'s own source, for the guards that check a rule no rendered
 * test can see.
 *
 * Two of those exist — `components/focus-ring-guard.test.ts` and
 * `landmark-guard.test.ts` — and each had grown its own copy of the same tree
 * walk and the same comment-stripping regex pair. A fix to either (excluding a
 * directory, picking up `.ts` files too) had to be made twice, with nothing
 * forcing the second edit.
 */

/** The root of the web app's source tree. */
export const WEB_SOURCE = path.resolve(fileURLToPath(import.meta.url), '..', '..');

export interface SourceFile {
  /** Path relative to `WEB_SOURCE`, which is what a failure should name. */
  name: string;
  /** The file's text with comments removed — see `withoutComments`. */
  code: string;
}

/**
 * What a scan reads. The JSX guards want components and nothing else, so `.tsx`
 * stays the default; a guard checking a rule that a route handler can also
 * break asks for `.ts` as well rather than making every other guard read files
 * it has no question about.
 */
export const TSX_ONLY = ['.tsx'] as const;
export const TS_AND_TSX = ['.ts', '.tsx'] as const;

async function walk(dir: string, extensions: readonly string[]): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walk(full, extensions)));
    } else if (
      extensions.some((extension) => entry.name.endsWith(extension)) &&
      !entry.name.includes('.test.')
    ) {
      found.push(full);
    }
  }

  return found;
}

/**
 * A URL's own slashes, a block comment, or a line comment — in that order,
 * because the order is the whole guard.
 *
 * A URL is matched **first and kept**, so neither comment rule can start inside
 * one. Anything less is a hole, and both halves have been one:
 *
 * - Without the URL alternative at all, `'https://host/path'` in a string reads
 *   as a line comment and the rest of that line disappears — the guard scanning
 *   the file quietly stops seeing it.
 * - Guarding it as `(^|[^:])//` instead is worse, and it is the version #395
 *   nearly shipped. The `:` stops the *line*-comment rule, then the scan
 *   advances one character and the second slash of `://*` opens a **block**
 *   comment that runs to the next `*​/` anywhere below. On `security-headers.ts`,
 *   whose CSP lists `'https://*.clerk.accounts.dev'`, that swallowed 151 lines.
 *
 * So the URL is consumed rather than merely stepped over. `[^\s'"\`]*` ends it
 * at whitespace or the closing quote, which is where a URL in source ends.
 */
const COMMENT = /(:\/\/[^\s'"`]*)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;

/**
 * Prose explaining a trap is not an instance of it.
 *
 * Every guard here works by matching source text, and this repository's
 * comments quote the very patterns being forbidden — so without this the
 * paragraph explaining a defect reports itself as one.
 *
 * Comments are blanked in place rather than removed, so a guard that prints
 * `file:line` — or `file:line:column` — names a position the reader can go to.
 * Four guards had each grown their own copy of this and no two agreed: two
 * preserved position and two guarded the URL case, none did both, and #395 was
 * about to make a fifth. This is the union of them, and the only one left.
 */
export function withoutComments(source: string): string {
  return source.replace(COMMENT, (match, url?: string) =>
    // A URL is matched only to be handed back untouched — see `COMMENT`. A real
    // comment is blanked rather than deleted, so every line *and column* after
    // it is still the one a reader finds at the `file:line` a guard prints.
    url === undefined ? match.replace(/[^\n]/g, ' ') : match,
  );
}

/**
 * Every non-test source file under `dir`, comments already stripped — `.tsx`
 * unless `extensions` widens it.
 *
 * Read once per call and returned whole: a guard file asks several questions of
 * the same text, and re-walking the tree and re-reading 150 files for each one
 * is work paid on every `vitest` run and in CI.
 */
export async function sourceFiles(
  dir: string = WEB_SOURCE,
  extensions: readonly string[] = TSX_ONLY,
): Promise<SourceFile[]> {
  const paths = await walk(dir, extensions);

  return Promise.all(
    paths.map(async (full) => ({
      name: path.relative(dir, full),
      code: withoutComments(await readFile(full, 'utf8')),
    })),
  );
}

/** One JSX element found by `elements`. */
export interface JsxElement {
  /** The tag name as written — `button`, `Button`, `Link`. */
  tag: string;
  /** Everything between the tag name and the closing `>` of the opening tag. */
  attributes: string;
  /** The markup between the opening and closing tags; `''` if self-closing. */
  children: string;
  /** 1-indexed line the opening tag starts on. */
  line: number;
}

/**
 * Every `<tag …>` in `code`, with its attributes and children.
 *
 * A regex cannot do this, and the guard that tried was near-vacuous because of
 * it: `/<button\b([^>]*)>/` stops at the **first** `>`, and an inline
 * `onClick={() => …}` puts one inside the opening tag. So the captured
 * attributes were a truncated prefix — an `aria-label` written after the
 * handler was invisible — and the "children" began with the tag's own leftover
 * attribute text, which made every such button look like it had visible
 * content. Deleting every `aria-label` in the tree left it reporting two
 * offenders where a real parse finds seven.
 *
 * This is not a JSX parser. It tracks brace depth and quoting well enough to
 * find the real end of an opening tag and the matching closing tag, which is
 * all any source guard here needs.
 */
export function elements(code: string, tag: string): JsxElement[] {
  const found: JsxElement[] = [];
  const opener = new RegExp(`<${tag}(?=[\\s/>])`, 'g');

  for (const match of code.matchAll(opener)) {
    const start = match.index;
    let at = start + match[0].length;
    let depth = 0;
    let quote: string | null = null;

    // Walk to the `>` that really closes the opening tag.
    while (at < code.length) {
      const char = code[at];

      if (quote !== null) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'" || char === '`') {
        quote = char;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
      } else if (char === '>' && depth === 0) {
        break;
      }

      at += 1;
    }

    if (at >= code.length) {
      continue;
    }

    const attributes = code.slice(start + match[0].length, at);
    const selfClosing = attributes.trimEnd().endsWith('/');

    let children = '';
    if (!selfClosing) {
      /*
       * The matching closer, counting nested same-tag opens. `<Button>` inside
       * `<Button>` does not occur here, but counting costs nothing and a guard
       * that silently pairs the wrong closer is worse than one that is slow.
       */
      let cursor = at + 1;
      let open = 1;
      const nested = new RegExp(`<${tag}(?=[\\s/>])|</${tag}>`, 'g');
      nested.lastIndex = cursor;

      for (let hit = nested.exec(code); hit !== null; hit = nested.exec(code)) {
        open += hit[0].startsWith('</') ? -1 : 1;
        if (open === 0) {
          children = code.slice(cursor, hit.index);
          cursor = hit.index;
          break;
        }
      }
    }

    found.push({
      tag,
      attributes,
      children,
      line: code.slice(0, start).split('\n').length,
    });
  }

  return found;
}
