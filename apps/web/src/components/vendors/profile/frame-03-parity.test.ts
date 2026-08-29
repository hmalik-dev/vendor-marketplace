import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/*
 * Frame `03 Vendor profile` is the acceptance criterion for the profile screen,
 * so every expectation below is READ OUT OF THE FRAME at test time rather than
 * written down as a number. A design re-import that moves the contract fails
 * here instead of passing silently, which is the whole point of the exercise.
 *
 * The frame's own numbers were also confirmed by rendering it headless at
 * 1440x900 and reading computed styles; the parity sweep ledger disagreed on
 * two of them (it recorded a 14px avatar overlap and a 39px `.inp` height,
 * where the frame renders 16px and 38px) and the frame wins.
 */

const frameHtml = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

/** The markup of one screen frame, selected by its `data-screen-label`. */
function frame(label: string): string {
  const start = frameHtml.indexOf(`data-screen-label="${label}"`);
  expect(start, `frame "${label}" is missing from the design file`).toBeGreaterThan(-1);

  // Frames are siblings, so the next one's marker is this one's end.
  const next = frameHtml.indexOf('data-screen-label="', start + 1);
  return frameHtml.slice(start, next === -1 ? frameHtml.length : next);
}

const FRAME_03 = frame('03 Vendor profile');

/** Every `style="..."` body in source order. */
const INLINE_STYLES = [...FRAME_03.matchAll(/style="([^"]*)"/g)].map((match) => match[1] as string);

/** The first inline style whose body matches every fragment given. */
function styleContaining(...fragments: readonly string[]): string {
  const found = INLINE_STYLES.find((style) =>
    fragments.every((fragment) => style.includes(fragment)),
  );
  expect(found, `no inline style in frame 03 contains ${fragments.join(' + ')}`).toBeDefined();
  return found as string;
}

/** One declaration's value out of a style body. */
function declaration(style: string, property: string): string {
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(style);
  expect(match, `"${property}" is missing from "${style}"`).not.toBeNull();
  return (match as RegExpExecArray)[1]!.trim();
}

/** The `px` numbers of a shorthand, in source order. */
function pxParts(value: string): number[] {
  return value.split(/\s+/).map((part) => Number.parseFloat(part));
}

describe('frame 03 — the profile is full-bleed (#103)', () => {
  /*
   * The frame lays the screen out as a full-width row: a fluid content column
   * beside a fixed rail. Both columns carry their own padding, and it is that
   * padding — not a centred max-width container — that makes the gutters.
   */
  const railStyle = styleContaining('width:380px', 'flex:none');
  const contentStyle = styleContaining('padding:18px 28px 0 40px');

  const railWidth = Number.parseFloat(declaration(railStyle, 'width'));
  const [, railRight] = pxParts(declaration(railStyle, 'padding'));
  const [, contentRight, , contentLeft] = pxParts(declaration(contentStyle, 'padding'));

  const source = readFileSync(
    join(process.cwd(), 'src', 'app', 'vendors', '[slug]', 'page.tsx'),
    'utf8',
  );
  const headerSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'profile-header.tsx'),
    'utf8',
  );

  it('reads the frame contract it is asserting against', () => {
    expect(railWidth).toBe(380);
    expect(railRight).toBe(40);
    expect(contentLeft).toBe(40);
    expect(contentRight).toBe(28);
  });

  it('sizes the rail column to the frame width', () => {
    expect(headerSource).toContain(`lg:grid-cols-[minmax(0,1fr)_${railWidth}px]`);
  });

  it('pads the shell to the frame gutter instead of centring a max-width box', () => {
    // 40px === Tailwind's `10` step, 28px === `7`.
    expect(headerSource).toContain(`lg:px-${contentLeft / 4}`);
    expect(headerSource).toContain(`lg:gap-x-${contentRight / 4}`);
  });

  it('leaves no centred container on either the shell or the identity block', () => {
    expect(source).not.toMatch(/max-w-7xl/);
    expect(headerSource).not.toMatch(/max-w-7xl/);
    expect(source).not.toMatch(/mx-auto grid/);
  });
});

describe('frame 03 — the rail starts level with the identity row (#104)', () => {
  /*
   * In the frame both columns open directly under the banner: the rail's own
   * `padding-top` is the entire gap between the banner's bottom edge and the
   * rail card. Laying the identity block out first and the rail out afterwards
   * — which is what shipped — dropped the card 102.8px below the banner
   * instead of 20px.
   */
  const railStyle = styleContaining('width:380px', 'flex:none');
  const [railTop] = pxParts(declaration(railStyle, 'padding'));

  const headerSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'profile-header.tsx'),
    'utf8',
  );
  const pageSource = readFileSync(
    join(process.cwd(), 'src', 'app', 'vendors', '[slug]', 'page.tsx'),
    'utf8',
  );

  it('reads the frame contract it is asserting against', () => {
    expect(railTop).toBe(20);
  });

  it('offsets the rail column from the banner by the frame padding', () => {
    // 20px === Tailwind's `5` step.
    expect(headerSource).toContain(`lg:pt-${railTop / 4}`);
  });

  it('opens both columns inside the wrapper that also holds the banner', () => {
    // The banner, the identity row and the rail slot are all one wrapper deep,
    // which is both the frame's layout and the non-clipping guarantee the
    // avatar overlap depends on.
    const wrapper = headerSource.indexOf('relative overflow-visible');
    const banner = headerSource.indexOf('data-testid="profile-cover"');
    const row = headerSource.indexOf('lg:grid-cols-[minmax(0,1fr)_380px]');
    const railSlot = headerSource.indexOf('{rail}');

    expect(wrapper).toBeGreaterThan(-1);
    expect(banner).toBeGreaterThan(wrapper);
    expect(row).toBeGreaterThan(banner);
    expect(railSlot).toBeGreaterThan(row);
  });

  it('no longer lays the rail out in a second row below the header', () => {
    expect(pageSource).not.toMatch(/lg:grid-cols-/);
    expect(pageSource).toContain('rail={');
  });
});

describe('frame 03 — the avatar overlaps the banner by 16px (#105)', () => {
  /*
   * The overlap is the SUM of two frame declarations, which is what made it
   * easy to get wrong: the content column is padded 18px from the top and the
   * identity row is then pulled up 34px against that padding. Net, 16px.
   *
   * The shipped page copied the -34px and dropped the 18px, so the avatar sank
   * to a 34px overlap and the business name rendered 11px inside the cover
   * photograph — text over arbitrary vendor-supplied imagery at a contrast
   * nothing can guarantee. Note that the sweep ledger recorded this as a 14px
   * overlap; rendering the frame gives 16px, and the frame is the contract.
   */
  const contentStyle = styleContaining('padding:18px 28px 0 40px');
  const identityStyle = styleContaining('margin-top:-34px');

  const [contentTop] = pxParts(declaration(contentStyle, 'padding'));
  const identityPull = Number.parseFloat(declaration(identityStyle, 'margin-top'));
  const overlap = -(contentTop + identityPull);

  const headerSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'profile-header.tsx'),
    'utf8',
  );

  it('reads the frame contract it is asserting against', () => {
    expect(contentTop).toBe(18);
    expect(identityPull).toBe(-34);
    expect(overlap).toBe(16);
  });

  it('pads the content column so the pull nets the frame overlap', () => {
    expect(headerSource).toContain(`pt-[${contentTop}px]`);
    expect(headerSource).toContain(`-mt-[${Math.abs(identityPull)}px]`);
  });

  it('leaves the business name clear of the banner', () => {
    /*
     * The row is 82px of avatar and the name block is pushed 23px down inside
     * it, so with a 16px overlap the name starts 7px BELOW the banner. That is
     * the whole reason the frame's number matters: at 34px it starts inside the
     * photograph.
     */
    const nameOffset = Number.parseFloat(
      declaration(styleContaining('margin-top:23px'), 'margin-top'),
    );

    expect(nameOffset - overlap).toBeGreaterThan(0);
    expect(headerSource).toContain(`mt-[${nameOffset}px]`);
  });
});

describe('frame 03 — the rail pairs Event date with Guests above Package (#107)', () => {
  /*
   * The frame's rail asks three questions in a fixed order, and the first two
   * share a row at `flex: 1` and `flex: .7` with a 10px gap. The shipped rail
   * asked only for the package, so the two answers the booking form needs most
   * were collected a screen later.
   */
  const pairRow = styleContaining('display:flex', 'gap:10px');
  const gap = Number.parseFloat(declaration(pairRow, 'gap'));

  const flexValues = [...FRAME_03.matchAll(/style="flex:(1|\.7)"/g)].map(
    (match) => match[1] as string,
  );

  const railSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'booking-rail.tsx'),
    'utf8',
  );

  /** Where a rail label sits in a body of source, by its literal. */
  const at = (source: string, label: string): number => source.indexOf(label);

  it('reads the frame contract it is asserting against', () => {
    expect(gap).toBe(10);
    expect(flexValues).toEqual(['1', '.7']);
    /*
     * Matched as whole `.lbl` elements: the bare word "Package" also appears
     * in the tab bar, 3000 characters earlier, and would order these wrongly.
     */
    expect(at(FRAME_03, '>Event date</div>')).toBeGreaterThan(-1);
    expect(at(FRAME_03, '>Guests</div>')).toBeGreaterThan(at(FRAME_03, '>Event date</div>'));
    expect(at(FRAME_03, '>Package</div>')).toBeGreaterThan(at(FRAME_03, '>Guests</div>'));
  });

  it('renders both fields, in the frame order, above the package', () => {
    expect(at(railSource, '>\n              Event date\n            </Label>')).toBeGreaterThan(-1);
    expect(at(railSource, 'Guests')).toBeGreaterThan(at(railSource, 'Event date'));
    expect(at(railSource, '>\n              Package\n            </Label>')).toBeGreaterThan(
      at(railSource, 'Guests'),
    );
  });

  it('splits the row at the frame ratio and gap', () => {
    // 10px === Tailwind's `2.5` step.
    expect(railSource).toContain(`gap-${gap / 4}`);
    expect(railSource).toContain('flex-1');
    expect(railSource).toContain(`flex-[0${flexValues[1] as string}]`);
  });

  it('carries both answers through to the booking request', () => {
    expect(railSource).toContain("request.set('date', eventDate)");
    expect(railSource).toContain("request.set('guests', guestCount)");
  });
});

describe('frame 03 — the rail controls carry the `.inp` token (#108)', () => {
  /*
   * `.inp` is a shared frame class, so it is read straight out of the frame's
   * own stylesheet rather than transcribed. The shipped package select drew a
   * `stone-0` card fill on an input, which is the one colour the token exists
   * to prevent — and the sweep ledger recorded its height as 39px where the
   * frame renders 38.
   */
  const inp = /\.inp\{([^}]*)\}/.exec(frameHtml);
  expect(inp, '`.inp` is missing from the design file').not.toBeNull();
  const rule = (inp as RegExpExecArray)[1] as string;

  const themeCss = readFileSync(
    join(process.cwd(), '..', '..', 'packages', 'config', 'tailwind', 'theme.css'),
    'utf8',
  );

  /** The theme token whose value is this hex, e.g. `#f1ece4` -> `stone-150`. */
  function tokenFor(hex: string): string {
    const found = new RegExp(`--color-([a-z0-9-]+):\\s*${hex.toLowerCase()};`).exec(themeCss);
    expect(found, `no theme token equals ${hex}`).not.toBeNull();
    return (found as RegExpExecArray)[1] as string;
  }

  const railSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'booking-rail.tsx'),
    'utf8',
  );

  it('reads the frame contract it is asserting against', () => {
    expect(declaration(rule, 'background')).toBe('#F1ECE4');
    expect(declaration(rule, 'padding')).toBe('10px 13px');
    expect(declaration(rule, 'border-radius')).toBe('10px');
  });

  it('fills every rail control with the frame token, not the card colour', () => {
    const fill = tokenFor(declaration(rule, 'background'));

    expect(fill).toBe('stone-150');
    expect(railSource).toContain(`bg-${fill}`);
    expect(railSource).not.toContain('bg-stone-0 px-');
  });

  it('pads and rounds them to the frame', () => {
    const [vertical, horizontal] = pxParts(declaration(rule, 'padding'));

    // 10px === Tailwind's `2.5` step; 13px has no step and is written exact.
    expect(railSource).toContain(`py-${(vertical as number) / 4}`);
    expect(railSource).toContain(`px-[${horizontal}px]`);
    expect(railSource).toContain('rounded-lg');
  });

  it('keeps a native select while replacing only its arrow', () => {
    // The element stays a real `<select>` — appearance is all that changes —
    // so the keyboard, the screen reader and the mobile picker are untouched.
    expect(railSource).toContain('<select');
    expect(railSource).toContain('appearance-none');
    expect(railSource).toContain('aria-hidden="true"');
  });
});

describe('frame 03 — chip and tile radii (#109)', () => {
  /*
   * Both shipped 2px over-rounded, because both reached for the nearest token
   * rather than the frame's number: the chips took `rounded-md` (8px, the
   * table-control step) and the strip took `rounded-xl` (14px, the card step).
   */
  const chipStyle = styleContaining('background:#F7E7E0', 'border-radius');
  const tileStyle = styleContaining('height:118px', 'border-radius');

  const chipRadius = Number.parseFloat(declaration(chipStyle, 'border-radius'));
  const tileRadius = Number.parseFloat(declaration(tileStyle, 'border-radius'));

  const themeCss = readFileSync(
    join(process.cwd(), '..', '..', 'packages', 'config', 'tailwind', 'theme.css'),
    'utf8',
  );

  const headerSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'profile-header.tsx'),
    'utf8',
  );
  const stripSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'portfolio-strip.tsx'),
    'utf8',
  );

  it('reads the frame contract it is asserting against', () => {
    expect(chipRadius).toBe(6);
    expect(tileRadius).toBe(12);
  });

  it('rounds the chips on the token that exists for them', () => {
    // `--radius-sm` is 6px and its own comment names category chips.
    expect(themeCss).toMatch(new RegExp(`--radius-sm:\\s*${chipRadius}px;`));
    expect(headerSource).toContain('rounded-sm');
    expect(headerSource).not.toContain('rounded-md');
  });

  it('rounds the strip tiles to the frame, which has no token', () => {
    // 12px sits between `--radius-lg` (10) and `--radius-xl` (14), so it is
    // written exact — the same call #41 made for the stat tiles.
    expect(themeCss).not.toMatch(new RegExp(`--radius-[a-z0-9]+:\\s*${tileRadius}px;`));
    expect(stripSource).toContain(`rounded-[${tileRadius}px]`);
    expect(stripSource).not.toContain('rounded-xl');
  });
});

describe('frame 03 — the availability line on the From row (#112)', () => {
  /*
   * The literal and its colour are read out of the frame rather than copied,
   * so the wording and the token stay tied to the contract.
   */
  // `#4B5940` is also the "Documentary style" chip's text colour, so the
  // availability line is selected by its full declaration rather than by hue.
  const lineStyle = styleContaining('font-size:12px', 'color:#4B5940', 'font-weight:600');
  const literal = /<span style="font-size:12px;color:#4B5940;font-weight:600">([^<]*)<\/span>/.exec(
    FRAME_03,
  );

  expect(literal, 'the frame no longer draws the availability line').not.toBeNull();
  const [, text] = literal as RegExpExecArray;

  const themeCss = readFileSync(
    join(process.cwd(), '..', '..', 'packages', 'config', 'tailwind', 'theme.css'),
    'utf8',
  );
  const railSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'booking-rail.tsx'),
    'utf8',
  );

  it('reads the frame contract it is asserting against', () => {
    expect(text as string).toMatch(/^Free on /);
    expect(declaration(lineStyle, 'font-size')).toBe('12px');
    expect(declaration(lineStyle, 'font-weight')).toBe('600');
  });

  it('renders the frame literal, not a paraphrase of it', () => {
    // The date itself varies with what the customer picks; the two words in
    // front of it are the contract.
    const prefix = (text as string).slice(0, (text as string).indexOf(' ', 'Free '.length));

    expect(prefix).toBe('Free on');
    expect(railSource).toContain(`${prefix} {freeOn}`);
  });

  it('colours it with the theme token that equals the frame colour', () => {
    const hex = declaration(lineStyle, 'color').toLowerCase();
    const token = new RegExp(`--color-([a-z0-9-]+):\\s*${hex};`).exec(themeCss);

    expect(token, `no theme token equals ${hex}`).not.toBeNull();
    expect((token as RegExpExecArray)[1]).toBe('sage-600');
    expect(railSource).toContain('text-sage-600');
    expect(railSource).toContain(`text-[${declaration(lineStyle, 'font-size')}]`);
  });

  it('reads availability the way the request form reads it', () => {
    // A vendor publishes only the days they are NOT free, so absence means
    // available. Both surfaces must apply that rule or they will disagree.
    expect(railSource).toContain("calendar[eventDate] ?? 'available'");
  });
});

describe('frame 03 — the punctuation is straight (#115)', () => {
  /*
   * The pull-quote shipped curly on a stated belief that the frame drew it
   * that way. It does not: the frame's pull-quote opens on U+0022 and frame
   * `03` contains no curly character at all, which the first assertion pins
   * so the rule stays derived from the contract rather than asserted here.
   */
  const CURLY = /[\u2018\u2019\u201C\u201D]/;
  const CURLY_ENTITY = /&(?:ldquo|rdquo|lsquo|rsquo);/;

  const components = [
    'about-pane.tsx',
    'booking-rail.tsx',
    'profile-header.tsx',
    'portfolio-strip.tsx',
  ];

  it('reads the frame contract it is asserting against', () => {
    expect(CURLY.test(FRAME_03)).toBe(false);
    // The pull-quote's own opening mark, straight.
    expect(FRAME_03).toContain('">"Quiet,');
  });

  it.each(components)('renders no curly punctuation from %s', (file) => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'components', 'vendors', 'profile', file),
      'utf8',
    );

    /*
     * Comments are stripped first: this very file's neighbours explain the
     * defect in prose, and naming a curly mark is not shipping one.
     */
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    expect(CURLY_ENTITY.test(code), `${file} still writes a curly entity`).toBe(false);
    expect(CURLY.test(code), `${file} still contains a curly character`).toBe(false);
  });
});

describe('frame 03 — the rail controls are one box (#107/#108)', () => {
  /*
   * The frame's `.inp` is one box used three times, so the three controls have
   * to be one class. They are not naturally the same height: `input[type=date]`
   * carries an intrinsic height from Chromium's calendar sub-control and lands
   * 1.5px taller than the `Guests` input beside it, which reads as a misaligned
   * pair on the frame's shared row. Pinning the height on the shared constant
   * is what keeps the three from drifting apart again.
   */
  const inp = /\.inp\{([^}]*)\}/.exec(frameHtml);
  const rule = (inp as RegExpExecArray)[1] as string;

  const railSource = readFileSync(
    join(process.cwd(), 'src', 'components', 'vendors', 'profile', 'booking-rail.tsx'),
    'utf8',
  );

  const [padY] = pxParts(declaration(rule, 'padding'));
  const border = Number.parseFloat(declaration(rule, 'border'));

  it('pins a height that is the frame padding and border around one text line', () => {
    const pinned = /h-\[(\d+(?:\.\d+)?)px\]/.exec(railSource);

    expect(pinned, 'the shared field class pins no height').not.toBeNull();
    const height = Number.parseFloat((pinned as RegExpExecArray)[1] as string);

    // 38 = 16px line box + 10px padding twice + 1px border twice.
    expect(height - 2 * (padY as number) - 2 * border).toBe(16);
    expect(height).toBe(38);
  });

  it('gives all three controls the same class, so they cannot diverge', () => {
    // `date`, `number` and `select` each take `FIELD` and nothing else sizing.
    expect(railSource.match(/className=\{FIELD\}/g)).toHaveLength(2);
    expect(railSource).toContain('className={`${FIELD} appearance-none`}');
  });
});
