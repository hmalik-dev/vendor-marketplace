import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Frame `09 Vendor profile editor` vs the live editor, on the axes the parity
 * sweep found failing.
 *
 * Expectations are read out of the frame file rather than written down here, so
 * a re-cut frame moves the target instead of silently disagreeing with a
 * hard-coded number. jsdom has no layout engine, so this cannot compare
 * `getBoundingClientRect` — the browser parity gate does that. What this file
 * does is stop the two sides drifting apart in source between browser passes.
 */
const designDirectory = join(process.cwd(), '../../design');
const framesFiles = readdirSync(designDirectory).filter((entry) =>
  entry.endsWith('Screens.dc.html'),
);

if (framesFiles.length !== 1) {
  throw new Error(
    `Expected exactly one screens frame file in design/, found ${framesFiles.length}`,
  );
}

const frames = readFileSync(join(designDirectory, framesFiles[0] as string), 'utf8');

/**
 * The frame block for one screen: from its labelled opening tag up to the start
 * of the next screen card, which is where the canvas separates them.
 */
function frameBlock(label: string): string {
  const start = frames.indexOf(`data-screen-label="${label}"`);
  expect(start).toBeGreaterThan(-1);

  const after = frames.indexOf('<div class="sc">', start);

  return frames.slice(start, after === -1 ? frames.length : after);
}

const editorFrame = frameBlock('09 Vendor profile editor');

const read = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');
const formSource = read('src/components/vendor-profile-form.tsx');

describe('frame 09 gives the form pane one visible heading', () => {
  /*
   * `.h2` is the frames' visible pane heading class. Frame 09 uses it exactly
   * once, for `Your storefront`. Everything the nav names — Business, Location,
   * Tags, Response time — appears only as a nav row, never as a heading over
   * the fields.
   */
  it('uses the visible pane-heading class exactly once', () => {
    expect(editorFrame.match(/class="h2"/g)).toHaveLength(1);
  });

  it('names that one heading Your storefront', () => {
    expect(editorFrame).toContain('>Your storefront<');
  });

  it('carries no visible section heading over the fields', () => {
    const paneHeadings = editorFrame.match(/class="h2"[^>]*>([^<]*)</g) ?? [];

    expect(paneHeadings.map((heading) => heading.replace(/.*>/, '').replace(/<$/, ''))).toEqual([
      'Your storefront',
    ]);
  });
});

describe('the editor matches that: section headings are visually hidden', () => {
  /**
   * Every `<h2>` the form renders, with the className it carries. The form's
   * only visible heading is the `<h1>`, so every `<h2>` under it must be
   * `sr-only` — present for the nav's anchors and for a screen reader, absent
   * for a sighted vendor, exactly as the frame shows.
   */
  const sectionHeadings = [...formSource.matchAll(/<h2 className="([^"]*)">([^<]*)<\/h2>/g)].map(
    ([, className, text]) => ({ className, text }),
  );

  it('renders the three section headings the nav anchors to', () => {
    expect(sectionHeadings.map((heading) => heading.text)).toEqual([
      'Business',
      'Location &amp; service area',
      'Tags',
    ]);
  });

  it.each(['Business', 'Location &amp; service area', 'Tags'])(
    'hides the %s heading visually while keeping it for assistive tech',
    (text) => {
      const heading = sectionHeadings.find((candidate) => candidate.text === text);

      expect(heading?.className).toBe('sr-only');
    },
  );

  /*
   * The regression this locks down: `Tags` shipped as a visible
   * `font-display text-display-sm` serif heading, which frame 09's pane has no
   * equivalent for and which the other two sections never had.
   */
  it('leaves no section heading rendering in the display serif', () => {
    for (const heading of sectionHeadings) {
      expect(heading.className).not.toContain('font-display');
      expect(heading.className).not.toContain('text-display');
    }
  });

  it('keeps Your storefront as the one visible heading, an h1', () => {
    expect(formSource).toContain('<h1 className="display-heading text-display-md text-stone-900">');
  });
});
