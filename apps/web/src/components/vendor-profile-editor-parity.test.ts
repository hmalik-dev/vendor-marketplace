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
const inputSource = read('src/components/ui/input.tsx');

/** One of the frames' shared component rules, e.g. `.inp{...}`. */
function frameRule(name: string): string {
  const match = frames.match(new RegExp(`\\.${name}\\{([^}]*)\\}`));
  expect(match).not.toBeNull();

  return match?.[1] ?? '';
}

/** A single declaration out of a frame rule, e.g. `padding` from `.inp`. */
function declaration(rule: string, property: string): string {
  const match = rule.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`));
  expect(match).not.toBeNull();

  return (match?.[1] ?? '').trim();
}

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

describe('the text inputs match the frame’s `.inp` box (#142)', () => {
  const inp = frameRule('inp');

  /*
   * The frame states padding and border; the 38px height follows from them.
   * 10px top + 10px bottom padding + a 16px line box for 13.5px text + 2 x 1px
   * border = 38px, which is what the frame's `.inp` nodes measure in a browser
   * at 1440x900. jsdom cannot lay that out, so the arithmetic is asserted from
   * the frame's own declarations and the height is pinned as a constant.
   */
  const FRAME_INPUT_HEIGHT_PX = 38;

  it('reads 10px 13px padding off the frame', () => {
    expect(declaration(inp, 'padding')).toBe('10px 13px');
  });

  it('reads a 1px border and a 10px radius off the frame', () => {
    expect(declaration(inp, 'border')).toBe('1px solid #E4DDD1');
    expect(declaration(inp, 'border-radius')).toBe('10px');
  });

  it('reads 13.5px text off the frame, which is the `text-base` token', () => {
    expect(declaration(inp, 'font-size')).toBe('13.5px');
  });

  it('gives the input the frame’s height rather than the old 32px', () => {
    expect(inputSource).toContain(`h-[${FRAME_INPUT_HEIGHT_PX}px]`);
    expect(inputSource).not.toMatch(/'h-8 w-full/);
  });

  it('gives the input the frame’s horizontal and vertical padding', () => {
    // `px-[13px]` is the frame's 13px; `py-2.5` is its 10px on the 4px scale.
    expect(inputSource).toContain('px-[13px]');
    expect(inputSource).toContain('py-2.5');
    expect(inputSource).not.toContain('px-2.5 py-1');
  });

  it('keeps the touch variant agreeing with the pointer-width height', () => {
    expect(inputSource).toContain(`INPUT_TOUCH_HEIGHT = 'h-11 lg:h-[${FRAME_INPUT_HEIGHT_PX}px]'`);
  });

  /*
   * Background is deliberately NOT set on the shared primitive. Across the
   * frames `.inp` is `#F1ECE4` by default and overridden to `#FFFDF9` on 26 of
   * its 38 instances — it tracks the surface underneath, not the control. Frame
   * 09 overrides all seven of its inputs, so the editor sets it at the call
   * site and frames 03/04/23/26 keep the filled default.
   */
  it('leaves the shared primitive’s background to the surface', () => {
    expect(inputSource).toContain('bg-transparent');
  });

  it('paints frame 09’s own fields stone-0, as every input in that frame is', () => {
    const frameInputs = editorFrame.match(/<div class="inp"[^>]*>/g) ?? [];

    expect(frameInputs).toHaveLength(7);
    for (const input of frameInputs) {
      expect(input).toContain('background:#FFFDF9');
    }

    // `--color-stone-0: #fffdf9`, so the editor's fields carry `bg-stone-0`.
    expect(formSource.match(/className="mt-1\.5 bg-stone-0"/g)).toHaveLength(6);
  });
});
