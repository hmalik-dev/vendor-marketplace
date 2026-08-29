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

/** The frame's three category chips, selected first. */
function chipsInFrame(): string[] {
  return (
    editorFrame.match(/<span style="display:inline-flex;align-items:center;gap:8px;[^"]*"/g) ?? []
  );
}

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

describe('the profile photo drop zone matches the frame (#143)', () => {
  const uploadSource = read('src/components/image-upload.tsx');

  /** The frame's own photo zone: a 128px circle with a 1px dashed edge. */
  const photoZone = editorFrame.match(
    /<div style="width:128px;height:128px;border-radius:50%;([^"]*)"/,
  );

  it('draws the photo zone at 128px in the frame', () => {
    expect(photoZone).not.toBeNull();
  });

  it('gives that zone a 1px dashed stone-400 edge in the frame', () => {
    // `--color-stone-400: #d5cec2`, and 17-vendor-profile-editor.md says
    // "dashed `stone-400` border" in words as well.
    expect(photoZone?.[1]).toContain('border:1px dashed #D5CEC2');
  });

  it('hatches the empty zone in the frame rather than filling it flat', () => {
    expect(photoZone?.[1]).toContain('repeating-linear-gradient(135deg,#E6DFD3 0 9px,#EFE9DF');
  });

  it('drops the 2px stone-200 edge the app shipped', () => {
    expect(uploadSource).toContain('border border-dashed border-stone-400');
    expect(uploadSource).not.toContain('border-2 border-dashed border-stone-200');
  });

  it('uses the frames’ own hatch utility while the zone is empty', () => {
    // `@utility placeholder-hatch` in theme.css carries exactly the frame's
    // gradient, so the two cannot drift.
    expect(uploadSource).toContain("value ? 'bg-stone-50' : 'placeholder-hatch'");
  });

  it('sizes the circle 128px from `sm`, not 160px', () => {
    expect(uploadSource).toContain('size-24 rounded-full sm:size-32');
    expect(uploadSource).not.toContain('sm:size-40');
    // The editor's wrapper has to agree or it re-crops the circle.
    expect(formSource).toContain('className="mt-4 w-24 sm:w-32"');
  });
});

describe('the category chips match the frame’s pills (#144)', () => {
  const pickerSource = read('src/components/category-picker.tsx');
  const iconSource = read('src/components/category-icon.tsx');

  /** The frame's three chips, selected first. */
  const chips =
    editorFrame.match(/<span style="display:inline-flex;align-items:center;gap:8px;[^"]*"/g) ?? [];

  it('finds the frame’s three chips', () => {
    expect(chips).toHaveLength(3);
  });

  it('reads 7px 13px 7px 8px padding off every chip', () => {
    for (const chip of chips) {
      expect(chip).toContain('padding:7px 13px 7px 8px');
    }
  });

  it('reads 13px text off every chip, which is the `text-action` token', () => {
    for (const chip of chips) {
      expect(chip).toContain('font-size:13px');
    }
  });

  it('reads weight 600 on the selected chip and 500 on the rest', () => {
    expect(chips[0]).toContain('font-weight:600');
    expect(chips[1]).toContain('font-weight:500');
    expect(chips[2]).toContain('font-weight:500');
  });

  it('reads a stone-300 edge on the unselected chips', () => {
    // `--color-stone-300: #e4ddd1`. The app shipped stone-200 (#EFE9E0).
    expect(chips[1]).toContain('border:1px solid #E4DDD1');
  });

  it('applies the frame’s padding and type to the chip', () => {
    expect(pickerSource).toContain('py-[7px] pr-[13px] pl-2 text-action');
    expect(pickerSource).not.toContain('py-1.5 pr-4 pl-1.5 text-sm');
  });

  it('gives the selected chip weight 600 and the rest 500', () => {
    expect(pickerSource).toContain('bg-clay-100 font-semibold');
    expect(pickerSource).toContain('bg-stone-0 font-medium');
  });

  it('moves the unselected edge from stone-200 to stone-300', () => {
    expect(pickerSource).toContain('border-stone-300 bg-stone-0');
    expect(pickerSource).not.toContain('border-stone-200 bg-stone-0');
  });

  it('sizes the icon badge 22px, which is what makes the chip 38px tall', () => {
    const badge = editorFrame.match(
      /<span style="width:22px;height:22px;border-radius:50%;background:(#[0-9A-F]{6})/i,
    );

    expect(badge).not.toBeNull();
    expect(iconSource).toContain('size-[22px]');
    expect(iconSource).not.toContain('size-7 shrink-0');
  });
});

describe('the submit-bar buttons match the frame’s .btnP / .btnS (#145)', () => {
  const btnP = frameRule('btnP');
  const btnS = frameRule('btnS');
  const buttonSource = read('src/components/ui/button.tsx');

  it('reads 13.5px weight-600 text off both frame buttons', () => {
    for (const rule of [btnP, btnS]) {
      expect(declaration(rule, 'font-size')).toBe('13.5px');
      expect(declaration(rule, 'font-weight')).toBe('600');
    }
  });

  it('reads a 10px radius off both, not 8px', () => {
    for (const rule of [btnP, btnS]) {
      expect(declaration(rule, 'border-radius')).toBe('10px');
    }
  });

  it('reads 20px side padding off both', () => {
    expect(declaration(btnP, 'padding')).toBe('11px 20px');
    expect(declaration(btnS, 'padding')).toBe('10px 20px');
  });

  /*
   * Both frame buttons measure 38px. `.btnP` gets there with 11px padding and
   * no border; `.btnS` with 10px padding and a 1px border. The app's default
   * size is `px-5 py-2.5` over the base's `border border-transparent`, so both
   * variants land on 10+10+16+2 = 38 — the same height by the same arithmetic.
   */
  it('keeps the default size on the frame’s 20px/10px padding and 10px radius', () => {
    expect(buttonSource).toContain("default: 'gap-2 px-5 py-2.5'");
    expect(buttonSource).toContain('rounded-lg');
    expect(buttonSource).toContain('text-base font-semibold');
  });

  /*
   * The regression: both controls shipped `size="sm"`, which is
   * `px-3 py-1.5 text-sm rounded-md` — 12.5px text on a 29px control with an
   * 8px radius, a whole size class below the frame.
   */
  it('no longer renders Save changes or Preview at the sm size', () => {
    expect(formSource).toContain('<Button type="submit" variant="primary" disabled={isSaving}>');
    expect(formSource).toContain('<Button type="button" variant="secondary" asChild>');
    expect(formSource).not.toContain('size="sm"');
  });
});

describe('the service-radius slider matches the frame (#146)', () => {
  const themeCss = readFileSync(
    join(process.cwd(), '../../packages/config/tailwind/theme.css'),
    'utf8',
  );
  const slider = themeCss.match(/@utility range-slider \{([\s\S]*?)\n\}/)?.[1] ?? '';

  it('draws a 4px track in the frame, not the browser’s default', () => {
    expect(editorFrame).toContain('height:4px;background:#EFE9E0;border-radius:999px');
  });

  it('fills the track to the value in clay-400', () => {
    expect(editorFrame).toContain('width:46%;height:4px;background:#B4552F');
  });

  it('rings a 14px stone-0 thumb in 2px clay-400', () => {
    expect(editorFrame).toContain(
      'width:14px;height:14px;border-radius:50%;background:#FFFDF9;border:2px solid #B4552F',
    );
  });

  it('defines a slider utility rather than leaning on accent-color', () => {
    expect(slider).not.toBe('');
    expect(formSource).toContain('className="range-slider mt-3.5"');
    expect(formSource).not.toContain('accent-clay-400');
  });

  it('gives the utility the frame’s 4px track and clay fill', () => {
    expect(slider).toContain('height: 4px');
    expect(slider).toContain('var(--color-clay-400) var(--range-fill, 0%)');
    expect(slider).toContain('var(--color-stone-200) var(--range-fill, 0%)');
  });

  it('gives the utility the frame’s 14px thumb and 2px ring', () => {
    expect(slider).toContain('width: 14px');
    expect(slider).toContain('background: var(--color-stone-0)');
    expect(slider).toContain('border: 2px solid var(--color-clay-400)');
  });

  it('covers Firefox as well as Chromium', () => {
    expect(slider).toContain('::-moz-range-thumb');
    expect(slider).toContain('::-moz-range-progress');
  });
});

describe('the selected chip’s label is clay, not stone (#147)', () => {
  const pickerSource = read('src/components/category-picker.tsx');
  const themeCss = readFileSync(
    join(process.cwd(), '../../packages/config/tailwind/theme.css'),
    'utf8',
  );

  it('reads #8E3F20 off the frame’s selected chip', () => {
    expect(chipsInFrame()[0]).toContain('color:#8E3F20');
  });

  it('leaves the unselected chips in stone-700', () => {
    // `--color-stone-700: #4a443c`, which is what the frame's other two carry.
    expect(chipsInFrame()[1]).toContain('color:#4A443C');
  });

  it('maps that colour to the clay-600 token', () => {
    expect(themeCss).toContain('--color-clay-600: #8e3f20');
  });

  it('paints the selected chip’s label clay-600', () => {
    expect(pickerSource).toContain('bg-clay-100 font-semibold text-clay-600');
  });

  /*
   * `stone-800` is not a step in this theme's ramp at all — it defines
   * stone-0/50/100/150/200/300/400/500/600/700/900 — so the old class fell
   * through to Tailwind's default cool stone, which is why it measured as a
   * neutral `oklch(0.268 0.007 34.298)` rather than any token in this theme.
   */
  it('stops using a stone step this theme never defines', () => {
    expect(pickerSource).not.toContain('text-stone-800');
    expect(themeCss).not.toContain('--color-stone-800:');
  });
});

describe('field labels take the frame’s label colour (#148)', () => {
  const labelSource = read('src/components/ui/label.tsx');
  const themeCss = readFileSync(
    join(process.cwd(), '../../packages/config/tailwind/theme.css'),
    'utf8',
  );
  const lbl = frameRule('lbl');

  it('reads #6B6459 off the frames’ `.lbl` rule', () => {
    expect(declaration(lbl, 'color')).toBe('#6B6459');
  });

  it('maps that to stone-600, the ramp’s label minimum', () => {
    expect(themeCss).toContain('--color-stone-600: #6b6459');
  });

  /*
   * The label carried no colour at all, so it inherited whatever ink surrounded
   * it — stone-900 in the editor. Inheriting is what made this a colour bug on
   * every form at once rather than one screen's.
   */
  it('gives the shared label its own colour rather than inheriting ink', () => {
    expect(labelSource).toContain('text-stone-600');
  });
});

describe('field labels are the frame’s uppercase micro-label (#149)', () => {
  const labelSource = read('src/components/ui/label.tsx');
  const themeCss = readFileSync(
    join(process.cwd(), '../../packages/config/tailwind/theme.css'),
    'utf8',
  );
  const lbl = frameRule('lbl');

  it('reads weight 600 at 10.5px off the frames’ `.lbl`', () => {
    expect(declaration(lbl, 'font')).toBe("600 10.5px 'Instrument Sans',sans-serif");
  });

  it('reads .05em uppercase off the frames’ `.lbl`', () => {
    expect(declaration(lbl, 'letter-spacing')).toBe('.05em');
    expect(declaration(lbl, 'text-transform')).toBe('uppercase');
  });

  it('has tokens for both, already named after this rule', () => {
    expect(themeCss).toContain('--text-label: 10.5px');
    expect(themeCss).toContain('--tracking-label: 0.05em');
  });

  it('dresses the shared label in all four', () => {
    expect(labelSource).toContain('text-label');
    expect(labelSource).toContain('font-semibold');
    expect(labelSource).toContain('tracking-label');
    expect(labelSource).toContain('uppercase');
  });

  /*
   * What shipped: `text-sm font-medium`, i.e. 12.5px/500 in sentence case —
   * a size up, a weight down, and not a micro-label at all.
   */
  it('drops the 12.5px/500 sentence-case treatment', () => {
    expect(labelSource).not.toContain('text-sm leading-none font-medium');
  });

  /*
   * The same four classes are the app's standing micro-label idiom, so the
   * primitive now agrees with the places that hand-rolled it.
   */
  it('matches the idiom the rest of the app already uses', () => {
    const rail = read('src/components/ui/rail.tsx');

    expect(rail).toContain('text-label font-semibold tracking-label text-stone-600 uppercase');
  });

  /*
   * The photo zone labels a file input it owns, so it is a bare `<label>`
   * rather than the primitive — but frame 09 draws `Profile photo` as a `.lbl`
   * like every other field label, so it takes the same treatment.
   */
  it('gives the photo zone’s own label the same treatment', () => {
    const uploadSource = read('src/components/image-upload.tsx');

    expect(editorFrame).toContain('<div class="lbl" style="margin-bottom:6px">Profile photo</div>');
    expect(uploadSource).toContain(
      'block text-label font-semibold tracking-label text-stone-600 uppercase',
    );
    expect(uploadSource).not.toContain('block text-sm font-medium text-stone-800');
  });
});

describe('frame 09’s text reaches the screen (#151)', () => {
  const uploadSource = read('src/components/image-upload.tsx');

  it('carries the radius value inside the label, as the frame does', () => {
    expect(editorFrame).toContain('Service radius — 60 miles');
    expect(formSource).toContain('Service radius — {form.serviceRadiusMiles} miles');
  });

  it('ends the slider with the frame’s two bounds', () => {
    expect(editorFrame).toContain('<span>5 mi</span><span>125 mi</span>');
    expect(formSource).toContain('{SERVICE_RADIUS_MIN_MILES} mi');
    expect(formSource).toContain('{SERVICE_RADIUS_MAX_MILES} mi');
  });

  /*
   * `Replace` is a real affordance rather than placeholder art: without it a
   * vendor who already has a photo sees no way to change it. The frame's
   * `portrait` mono line beside it *is* placeholder art — the labelled
   * placeholder that `web-design-parity.md` explicitly allows real photography
   * to replace — so it is deliberately not reproduced.
   */
  it('labels a filled photo zone Replace, as the frame does', () => {
    expect(editorFrame).toContain('>Replace</span>');
    expect(uploadSource).toContain('Replace');
  });

  it('keeps an honest empty state rather than the frame’s placeholder label', () => {
    expect(editorFrame).toContain('>portrait</span>');
    expect(uploadSource).toContain("'Add photo'");
    expect(uploadSource).not.toContain('>portrait<');
  });
});

describe('helper lines the frame does not draw (#152)', () => {
  /*
   * Frame 09's form pane carries exactly one helper line: the gold
   * `Required before you can publish` under the response-time field. Every
   * other helper on the screen is the app's own.
   */
  it('draws one helper in the frame, and it is the publish blocker', () => {
    expect(editorFrame).toContain('Required before you can publish');
    expect(editorFrame.match(/color:#7A5A12/g)).toHaveLength(1);
  });

  it('keeps that blocker helper, which is sourced', () => {
    expect(formSource).toContain('Required before you can publish');
  });

  /*
   * Removed: the radius helper is superseded by the frame's own `5 mi` /
   * `125 mi` bounds, which say the same thing in the frame's words, and the
   * About helper is decoration the frame has no equivalent for.
   */
  it('drops the radius helper the frame replaces with its bounds', () => {
    expect(formSource).not.toContain('How far you will travel for an event');
  });

  it('drops the decorative About helper', () => {
    expect(formSource).not.toContain('A couple of paragraphs is plenty');
  });

  /*
   * Kept on purpose. `40-states.md` requires this exact line: "Constraints,
   * stated before the picker opens … The same line appears in the drop zone
   * and the requirements rail." It is sourced, so it is not an offender.
   */
  it('keeps the upload constraint line, which 40-states.md mandates', () => {
    expect(formSource).toContain('UPLOAD_CONSTRAINT_LINE');
  });
});
