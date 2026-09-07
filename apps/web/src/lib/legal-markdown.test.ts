import { describe, expect, it } from 'vitest';
import { applyFactTokens, legalDocumentText, parseLegalMarkdown } from './legal-markdown';

/**
 * The legal Markdown parser, at its edges.
 *
 * It is bespoke rather than a library, so the cases a library would have
 * covered are this file's job: a malformed file has to fail at load rather than
 * render a page that looks fine and is missing a clause, and a placeholder
 * nobody defined has to stay visible rather than blank the sentence around it.
 */
const FACTS = { brand: 'Testmark', commission: '12%' };

function doc(body: string, facts: Record<string, string> = FACTS) {
  return parseLegalMarkdown(
    'terms',
    `---\ntitle: A page\nlastUpdated: 2026-06-04\n---\n${body}`,
    facts,
  );
}

describe('frontmatter', () => {
  it('refuses a file with no frontmatter block', () => {
    expect(() => parseLegalMarkdown('terms', '## Heading\n\nBody.')).toThrow(/no frontmatter/);
  });

  it('refuses a missing or malformed last-updated date', () => {
    expect(() => parseLegalMarkdown('terms', '---\ntitle: A\n---\nBody.')).toThrow(/lastUpdated/);
    expect(() =>
      parseLegalMarkdown('terms', '---\ntitle: A\nlastUpdated: June 4\n---\nB.'),
    ).toThrow(/lastUpdated/);
  });

  it('refuses a frontmatter line that is not a key and a value', () => {
    expect(() => parseLegalMarkdown('terms', '---\ntitle: A\nnonsense\n---\nB.')).toThrow(
      /key: value/,
    );
  });

  it('leaves the note null when the file states none', () => {
    expect(doc('Body.').note).toBeNull();
  });
});

describe('blocks', () => {
  it('collects text before the first heading as the lead', () => {
    const parsed = doc('Short version.\n\n## One\n\nBody.');

    expect(parsed.lead).toHaveLength(1);
    expect(parsed.sections).toHaveLength(1);
  });

  it('numbers sections by position and slugs them by text', () => {
    const parsed = doc('## First one\n\nA.\n\n## Second — with punctuation\n\nB.');

    expect(parsed.sections.map((s) => [s.number, s.id])).toEqual([
      [1, 'first-one'],
      [2, 'second-with-punctuation'],
    ]);
  });

  it('reads a table, dropping its divider row', () => {
    const parsed = doc('| A | B |\n| --- | --- |\n| one | two |\n| three | four |');
    const table = parsed.lead[0];

    expect(table.kind).toBe('table');
    expect(table.kind === 'table' && table.header).toEqual(['A', 'B']);
    expect(table.kind === 'table' && table.rows).toHaveLength(2);
  });

  it('reads the two fenced blocks and nothing else as a fence', () => {
    const parsed = doc(':::panel\nOne.\n:::\n\n:::note\nTwo.\n:::\n\n:::unknown\nThree.\n:::');

    expect(parsed.lead.map((block) => block.kind)).toEqual([
      'panel',
      'note',
      // An unrecognised directive is prose, not a silent drop.
      'paragraph',
      'paragraph',
      'paragraph',
    ]);
  });

  it('refuses an unclosed fence rather than swallowing the rest of the page', () => {
    expect(() => doc(':::panel\nOne.\n\n## Two\n\nBody.')).toThrow(/unclosed/);
  });

  /**
   * The link target is the one construct this parser takes from the file
   * rather than deriving, and it is the one that becomes executable. The copy
   * is meant to be replaced by somebody who has never opened this repository,
   * so an unrecognised scheme degrades to plain text: the sentence still reads
   * and the link simply is not one.
   */
  it.each([
    ['/privacy', true],
    ['/terms#cancellations-and-refunds', true],
    ['#who-we-are', true],
    ['https://stripe.com/legal', true],
    ['mailto:legal@example.com', true],
    ["javascript:fetch('//evil')", false],
    ['JaVaScRiPt:alert(1)', false],
    ['data:text/html,<script>alert(1)</script>', false],
    ['vbscript:msgbox(1)', false],
    ['//evil.example.com', false],
    ['http://insecure.example.com', false],
  ])('keeps %s as a link: %s', (href, linked) => {
    const block = doc(`A [link](${href}) here.`).lead[0];
    const span =
      block.kind === 'paragraph' ? block.spans.find((s) => s.text === 'link') : undefined;

    expect([href, span?.href !== undefined]).toEqual([href, linked]);
    // Either way the words survive — a dropped target never eats the sentence.
    expect(span?.text).toBe('link');
  });

  it('reads bold, code and links inside a paragraph', () => {
    const spans = doc('A **bold** and `code` and a [link](/privacy).').lead[0];

    expect(spans.kind === 'paragraph' && spans.spans).toEqual([
      { text: 'A ' },
      { text: 'bold', bold: true },
      { text: ' and ' },
      { text: 'code', code: true },
      { text: ' and a ' },
      { text: 'link', href: '/privacy' },
      { text: '.' },
    ]);
  });
});

describe('fact placeholders', () => {
  it('substitutes every known placeholder, in headings as well as prose', () => {
    const parsed = doc('## What {{brand}} keeps\n\n{{brand}} retains {{commission}}.');

    expect(parsed.sections[0].title).toBe('What Testmark keeps');
    expect(legalDocumentText(parsed)).toContain('Testmark retains 12%.');
  });

  /**
   * Visible rather than blank. A placeholder somebody mistyped should show up
   * on the page as `{{comission}}` and be noticed, not quietly delete the
   * number the sentence was about.
   */
  it('leaves an unknown placeholder in place rather than blanking it', () => {
    expect(applyFactTokens('We keep {{comission}}.', FACTS)).toBe('We keep {{comission}}.');
  });

  it('substitutes the title and the note from the frontmatter too', () => {
    const parsed = parseLegalMarkdown(
      'terms',
      '---\ntitle: {{brand}} terms\nlastUpdated: 2026-06-04\nnote: Written by {{brand}}\n---\nBody.',
      FACTS,
    );

    expect([parsed.title, parsed.note]).toEqual(['Testmark terms', 'Written by Testmark']);
  });
});
