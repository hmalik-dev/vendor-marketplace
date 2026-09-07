import { generateSlug, legalFactTokens, type LegalContentSlug } from '@vendor-marketplace/shared';

/**
 * The small, deliberate Markdown the legal pages are written in.
 *
 * Not a Markdown library, and that is the point rather than an economy. Frame
 * `31` gives a legal page exactly three content blocks — an emphasis panel, a
 * data table and a sage note — plus numbered headings and prose, and a general
 * parser would let a future editor reach for a heading level, an image or a
 * list that this layout has no design for. What it accepts is what the frame
 * draws; anything else is a paragraph.
 *
 * **Numbers never appear in the markdown.** `{{commission}}` and its five
 * siblings resolve through `legalFactTokens()` at render time, so a rate that
 * moves moves on the page too — acceptance 15 of #427. An unknown placeholder
 * is left alone rather than silently blanked, so the mistake is visible on the
 * page rather than only in a diff nobody reads.
 */

/** A run of prose, and what it links to or emphasises. */
export interface LegalSpan {
  text: string;
  bold?: boolean;
  code?: boolean;
  href?: string;
}

export type LegalBlock =
  | { kind: 'paragraph'; spans: LegalSpan[] }
  /** `stone-100` emphasis panel — a clause with commercial consequence. */
  | { kind: 'panel'; paragraphs: LegalSpan[][] }
  /** `sage-50` note — a reassurance that is a statement of fact. */
  | { kind: 'note'; paragraphs: LegalSpan[][] }
  | { kind: 'table'; header: string[]; rows: LegalSpan[][][] };

export interface LegalSection {
  /**
   * The section number the page prints and the world cites. Position in the
   * file, so renumbering is what editing the file does.
   */
  number: number;
  title: string;
  /**
   * The heading's anchor. **Derived from the text, never from the counter** —
   * these are public URLs people paste into email, and `#section-5` would move
   * the moment a section is inserted above it.
   */
  id: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: LegalContentSlug;
  title: string;
  /** `YYYY-MM-DD`, straight out of the frontmatter. Nobody edits a date in JSX. */
  lastUpdated: string;
  /** The optional second clause after the `·` on the last-updated line. */
  note: string | null;
  /** Blocks standing before the first heading — `/privacy`'s short version. */
  lead: LegalBlock[];
  sections: LegalSection[];
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/;
const FACT_PLACEHOLDER = /\{\{(\w+)\}\}/g;
const HEADING = /^##\s+(.*)$/;
const FENCE = /^:::(panel|note)\s*$/;
const TABLE_DIVIDER = /^\|[\s:|-]+\|$/;
/** `**bold**`, `` `code` `` and `[text](href)`, in one pass so they cannot nest. */
const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
/**
 * The link targets a legal page may carry: a route in this app, an anchor on
 * the page itself, an explicit `https` destination, or an email address.
 *
 * An allowlist rather than a `javascript:` denylist, because the denylist is
 * the version that loses — `JaVaScRiPt:`, `data:text/html`, `vbscript:` and a
 * leading control character are all the same class and only one of them is
 * ever in the list somebody wrote.
 */
const SAFE_HREF = /^(?:\/(?!\/)|#|https:\/\/|mailto:)/;

export interface LegalFrontmatter {
  title: string;
  lastUpdated: string;
  note: string | null;
}

/**
 * Splits the frontmatter off the body.
 *
 * Deliberately strict: `key: value` on its own line and nothing else. A legal
 * page with no `lastUpdated` is one whose date line would silently disappear,
 * so a missing key throws at load rather than rendering a page that looks fine
 * and is missing the one element frame `31` calls required.
 */
export function parseFrontmatter(source: string): { data: LegalFrontmatter; body: string } {
  const match = FRONTMATTER.exec(source);

  if (!match) {
    throw new Error('legal content: no frontmatter block');
  }

  const data: Record<string, string> = {};

  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');

    if (colon < 0) {
      throw new Error(`legal content: frontmatter line is not "key: value": ${line}`);
    }

    data[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }

  if (!data.title) {
    throw new Error('legal content: frontmatter has no title');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.lastUpdated ?? '')) {
    throw new Error(`legal content: lastUpdated must be YYYY-MM-DD, got ${data.lastUpdated}`);
  }

  return {
    data: { title: data.title, lastUpdated: data.lastUpdated, note: data.note ?? null },
    body: source.slice(match[0].length),
  };
}

/**
 * Replaces `{{placeholder}}` with the value the constants decide.
 *
 * Exported because the guard that keeps digits out of the markdown needs the
 * same substitution the page performs, and a second implementation of it is
 * how a guard comes to pass against something the page never renders.
 */
export function applyFactTokens(text: string, facts: Record<string, string>): string {
  return text.replace(FACT_PLACEHOLDER, (whole, name: string) => facts[name] ?? whole);
}

function inlineSpans(text: string): LegalSpan[] {
  const spans: LegalSpan[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE)) {
    const at = match.index;

    if (at > cursor) {
      spans.push({ text: text.slice(cursor, at) });
    }

    if (match[1] !== undefined) {
      spans.push({ text: match[1], bold: true });
    } else if (match[2] !== undefined) {
      spans.push({ text: match[2], code: true });
    } else {
      /*
       * The link target is the one thing this parser would otherwise take
       * verbatim, and it is the one thing that becomes executable.
       *
       * Nothing crosses a trust boundary today — the four documents are
       * committed files compiled at build time. But the whole point of keeping
       * the copy in Markdown is that it can be replaced by somebody who has
       * never opened this repository, and at that moment
       * `[Read this](javascript:…)` pasted out of a Word document renders as a
       * live anchor on a public page with this function as the only filter.
       * An unrecognised target degrades to plain text: the sentence still
       * reads, and the link simply is not one.
       */
      spans.push(
        SAFE_HREF.test(match[4]) ? { text: match[3], href: match[4] } : { text: match[3] },
      );
    }

    cursor = at + match[0].length;
  }

  if (cursor < text.length) {
    spans.push({ text: text.slice(cursor) });
  }

  return spans;
}

function tableCells(line: string): string[] {
  return line
    .slice(1, line.endsWith('|') ? -1 : undefined)
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * Turns one document's markdown into the blocks the layout draws.
 *
 * `facts` is a parameter rather than a module read so a test can move a number
 * and watch the rendered page follow it — which is the only way acceptance 15
 * is proved rather than asserted.
 */
export function parseLegalMarkdown(
  slug: LegalContentSlug,
  source: string,
  facts: Record<string, string> = legalFactTokens(),
): LegalDocument {
  const { data, body } = parseFrontmatter(source);
  const lines = applyFactTokens(body, facts).split('\n');

  const lead: LegalBlock[] = [];
  const sections: LegalSection[] = [];
  let blocks = lead;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);

    if (heading) {
      const title = heading[1].trim();

      blocks = [];
      sections.push({ number: sections.length + 1, title, id: generateSlug(title), blocks });
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line.trim());

    if (fence) {
      const paragraphs: LegalSpan[][] = [];
      index += 1;

      while (index < lines.length && lines[index].trim() !== ':::') {
        if (lines[index].trim().length > 0) {
          paragraphs.push(inlineSpans(lines[index].trim()));
        }
        index += 1;
      }

      if (index >= lines.length) {
        throw new Error(`legal content: unclosed ::: ${fence[1]} block`);
      }

      blocks.push({ kind: fence[1] === 'panel' ? 'panel' : 'note', paragraphs });
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('|')) {
      const cells: string[][] = [];

      while (index < lines.length && lines[index].trimStart().startsWith('|')) {
        const raw = lines[index].trim();

        if (!TABLE_DIVIDER.test(raw)) {
          cells.push(tableCells(raw));
        }
        index += 1;
      }

      const [header, ...rest] = cells;

      /*
       * A run of `|` lines that is nothing but a divider leaves no header row,
       * and `LegalTable` reads `header.length` to build its grid. Array
       * destructuring is outside `noUncheckedIndexedAccess`, so TypeScript
       * types this as present and the crash would land at build time on a file
       * somebody had just edited — a paragraph is the honest degradation.
       */
      if (header === undefined) {
        blocks.push({ kind: 'paragraph', spans: [] });
        continue;
      }

      blocks.push({ kind: 'table', header, rows: rest.map((row) => row.map(inlineSpans)) });
      continue;
    }

    blocks.push({ kind: 'paragraph', spans: inlineSpans(line.trim()) });
    index += 1;
  }

  return {
    slug,
    title: applyFactTokens(data.title, facts),
    lastUpdated: data.lastUpdated,
    note: data.note === null ? null : applyFactTokens(data.note, facts),
    lead,
    sections,
  };
}

/** The plain text of a document, for the guards that read what a page says. */
export function legalDocumentText(document: LegalDocument): string {
  const fromBlocks = (blocks: LegalBlock[]): string =>
    blocks
      .map((block) => {
        if (block.kind === 'paragraph') {
          return block.spans.map((span) => span.text).join('');
        }
        if (block.kind === 'table') {
          return [
            block.header.join(' '),
            ...block.rows.map((row) =>
              row.map((cell) => cell.map((span) => span.text).join('')).join(' '),
            ),
          ].join('\n');
        }
        return block.paragraphs
          .map((paragraph) => paragraph.map((span) => span.text).join(''))
          .join('\n');
      })
      .join('\n');

  return [
    document.title,
    document.note ?? '',
    fromBlocks(document.lead),
    ...document.sections.map(
      (section) => `${section.number} ${section.title}\n${fromBlocks(section.blocks)}`,
    ),
  ].join('\n');
}
