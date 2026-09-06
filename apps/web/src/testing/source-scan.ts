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

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await walk(full)));
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      found.push(full);
    }
  }

  return found;
}

/**
 * Prose explaining a trap is not an instance of it.
 *
 * Every guard here works by matching source text, and this repository's
 * comments quote the very patterns being forbidden — so without this the
 * paragraph explaining a defect reports itself as one.
 */
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Every non-test `.tsx` file under `dir`, comments already stripped.
 *
 * Read once per call and returned whole: a guard file asks several questions of
 * the same text, and re-walking the tree and re-reading 150 files for each one
 * is work paid on every `vitest` run and in CI.
 */
export async function sourceFiles(dir: string = WEB_SOURCE): Promise<SourceFile[]> {
  const paths = await walk(dir);

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
