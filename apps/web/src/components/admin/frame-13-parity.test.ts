import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Frame `13 Admin` vs the console, on the axes jsdom can settle.
 *
 * Expectations are read out of the frame file rather than written down here, so
 * a re-cut frame moves the target instead of silently disagreeing with a
 * hard-coded number. jsdom has no layout engine, so this cannot measure whether
 * fifteen rows fit — the browser parity gate does that, and it is the one thing
 * `22-admin.md` says to verify rather than assume. What this file guards is the
 * class of drift a browser pass is worst at catching: a token quietly replaced
 * by a near neighbour, a track list edited in one of the two places it is used,
 * a string reworded.
 */

const designDirectory = join(process.cwd(), '../../design');
const framesFile = readdirSync(designDirectory).filter((entry) =>
  entry.endsWith('Screens.dc.html'),
);

if (framesFile.length !== 1) {
  throw new Error(`Expected exactly one screens frame file in design/, found ${framesFile.length}`);
}

const frames = readFileSync(join(designDirectory, framesFile[0] as string), 'utf8');
const themeCss = readFileSync(
  join(process.cwd(), '../../packages/config/tailwind/theme.css'),
  'utf8',
);

/** Frame `13`'s own markup, from its label to the start of the next frame. */
function adminFrame(): string {
  const start = frames.indexOf('data-screen-label="13 Admin"');
  expect(start).toBeGreaterThan(-1);
  const next = frames.indexOf('data-screen-label=', start + 1);

  return frames.slice(start, next === -1 ? undefined : next);
}

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

/**
 * One of the frame file's shared CSS rules, by selector.
 *
 * `.nav` and `.pill` are the two misses `#392` closed that live in the
 * stylesheet rather than in frame `13`'s own markup, so the frame slice above
 * cannot reach them. Read here for the same reason every other expectation in
 * this file is read off the frame: a re-cut moves the target instead of
 * silently disagreeing with a number written down beside it.
 */
function frameRule(selector: string): string {
  const rule = new RegExp(`\\${selector}\\{([^}]*)\\}`).exec(frames);
  expect(rule, selector).not.toBeNull();

  return (rule as RegExpExecArray)[1] as string;
}

const frame = adminFrame();
const dataTable = read('src/components/admin/data-table.tsx');
const vendorTable = read('src/components/admin/vendor-table.tsx');
const header = read('src/components/admin/admin-header.tsx');
const nav = read('src/components/admin/admin-nav.tsx');
const surface = read('src/components/admin/admin-surface.tsx');
const vendorsPage = read('src/app/admin/vendors/page.tsx');
/*
 * The labels moved out of the component and into the shared enum (#433), so the
 * table's pill and the filter bar's options cannot be worded differently. The
 * tone stays in the component, because it is a rendering decision; the word is a
 * contract, so it is read from where the contract lives.
 */
const statusLabels = read('../../packages/shared/src/schemas/index.ts');

describe('the inverted header (frame `13`)', () => {
  it('reads the ground and the hairline off the frame', () => {
    expect(frame).toContain('background:#23201C;border-bottom-color:#3A342E');
  });

  it('maps both to tokens this theme defines', () => {
    expect(themeCss).toContain('--color-stone-900: #23201c');
    expect(themeCss).toContain('--color-stone-800: #3a342e');
  });

  it('paints the bar with those tokens rather than the hexes', () => {
    expect(header).toContain('border-b border-stone-800 bg-stone-900');
    // The whole point of a token: no inline hex survives in the component.
    expect(header).not.toMatch(/#[0-9A-Fa-f]{6}/);
  });

  it('keeps the frame’s `Admin` chip wording and case', () => {
    expect(frame).toContain('>Admin</span>');
    expect(header).toContain('>\n          Admin\n        </span>');
  });

  it('sets the chip ground at the frame’s 12% white', () => {
    expect(frame).toContain('background:rgba(255,253,249,.12)');
    // `stone-0` *is* #FFFDF9, so `bg-stone-0/12` is that value, not a lookalike.
    expect(themeCss).toContain('--color-stone-0: #fffdf9');
    expect(header).toContain('bg-stone-0/12');
  });
});

describe('the 210px rail', () => {
  it('reads the width off the frame', () => {
    expect(frame).toContain('class="side" style="width:210px"');
  });

  it('has a token of that width, and uses it', () => {
    // 13.125rem × 16 = 210px.
    expect(themeCss).toContain('--sidebar-admin-width: 13.125rem');
    expect(nav).toContain('lg:w-(--sidebar-admin-width)');
  });

  it('is content-box, so the token measures the frame’s footprint', () => {
    // `.side` is content-box in the frames: 210 of content plus 12px gutters and
    // a 1px border. Border-box would render the rail 25px narrow.
    expect(nav).toContain('lg:box-content');
  });

  it('lists the seven sections the frame draws, in the frame’s order and wording', () => {
    const drawn = [...frame.matchAll(/class="nav(?: navA)?">([^<]+)/g)].map((match) =>
      (match[1] as string).trim(),
    );

    expect(drawn).toEqual([
      'Overview',
      'Vendors',
      'Customers',
      'Bookings',
      'Payments',
      'Reviews',
      'Categories &amp; tags',
    ]);

    for (const label of drawn) {
      expect(nav, label).toContain(`label: '${label.replace('&amp;', '&')}'`);
    }
  });

  /*
   * The rail's pitch, which `#392` found 14px too tall on every one of the
   * seven rows — the rail ended 93px below where frame `13` draws it.
   *
   * `.side` sets no `gap`, so in the frame an item's pitch *is* its height:
   * 9px of padding either side of a 13.5px line box. The app had a `min-h-11`
   * floor and a `gap-1` between items, which is 44 + 4. Both are right below
   * `lg`, where there is no rail at all and the strip is a touch target under
   * `04-laws.md`; both are wrong from `lg` up, where the frame applies. So the
   * assertions below are on the `lg:` branch, and the mobile floor is asserted
   * to survive rather than being collateral of the fix.
   */
  it('builds a rail row out of the frame’s own box, not a 44px floor', () => {
    const navRule = frameRule('.nav');

    expect(navRule).toContain('padding:9px 12px');
    expect(navRule).toContain('border-radius:9px');
    expect(navRule).toContain('font-size:13.5px');
    expect(navRule).toContain('font-weight:500');
    expect(navRule).toContain('gap:10px');

    /*
     * 12px, 9px, 9px, 10px and 13.5px — anchored on the *link's* own fragment
     * rather than class by class. A bare `toContain('px-3')` is satisfied twice
     * over: by `px-3.5`, which this file warns about elsewhere, and by the
     * `<nav>` wrapper's own `px-3`, so mutating the link to `px-4` left it green.
     */
    expect(nav).toContain('items-center gap-2.5 rounded-[9px] px-3 py-2.25 text-base font-medium');
    expect(themeCss).toContain('--text-base: 13.5px');
  });

  it('drops the 44px floor and the inter-item gap where the frame draws the rail', () => {
    // Kept below `lg`: the strip is a touch target there, and no frame draws it.
    expect(nav).toContain('min-h-11');
    // And released at `lg`, or the row is 44px tall against the frame's 34.
    expect(nav).toContain('lg:min-h-0');

    /*
     * `.side` declares no `gap`, so seven `gap-1`s put the last row 24px low
     * and the rail 93px low overall once the height error compounds with it.
     */
    expect(frameRule('.side')).not.toContain('gap:');
    expect(nav).toContain('lg:gap-0');
  });

  it('marks the active item the way `.navA` does', () => {
    expect(frame).toContain('class="nav navA"');
    // `.navA{background:#F7E7E0;color:#8E3F20;font-weight:600;box-shadow:inset 3px 0 0 #B4552F}`
    expect(nav).toContain('bg-clay-100 font-semibold text-clay-600');
    expect(nav).toContain('shadow-[inset_3px_0_0_var(--color-clay-400)]');
  });
});

describe('the table', () => {
  it('declares the frame’s tracks once, on the columns themselves', () => {
    /*
     * The frame repeats the same `grid-template-columns` on every row. Here the
     * track lives on the column it sizes and `DataTable` joins them into one
     * custom property, so the header row and the body rows read a single value
     * — two hand-synchronised lists is how the columns stop lining up.
     */
    expect(frame).toContain('grid-template-columns:22px 1.6fr 1.1fr 1fr .7fr .8fr .9fr 70px');

    const tracks = [...vendorTable.matchAll(/width: '([^']+)'/g)].map((match) => match[1]);
    expect(tracks.join(' ')).toBe('22px 1.6fr 1.1fr 1fr .7fr .8fr .9fr 70px');

    /*
     * Joined once, and each flexible track floored at zero on the way through
     * — `#389`. The column specs stay the frame's own track list, read back
     * verbatim above; `resolveTrack` is what stops a bare `<flex>` minimum
     * letting one row's content resize that row alone.
     */
    expect(dataTable).toContain("columns.map((column) => resolveTrack(column.width)).join(' ')");
    expect(dataTable.match(/grid-cols-\(--admin-table-columns\)/g)).toHaveLength(2);
  });

  it('draws the surface, border and radius the frame draws', () => {
    expect(frame).toContain('background:#FFFDF9;border:1px solid #E4DDD1;border-radius:12px');
    expect(themeCss).toContain('--color-stone-300: #e4ddd1');
    /*
     * 12px is `--radius-panel`, and `--radius-xl` on the line above it is 14 —
     * near neighbours in the same ramp, which is exactly the drift a browser
     * pass is worst at seeing and this file exists to catch. The pane read
     * `rounded-xl` for four parity passes (#392).
     */
    expect(themeCss).toContain('--radius-panel: 12px');
    expect(dataTable).toContain('rounded-panel border border-stone-300 bg-stone-0');
    expect(dataTable).not.toContain('rounded-xl');
  });

  it('fixes the header row and scrolls the body, not the page', () => {
    // `22-admin.md`'s first acceptance line. `sticky` inside the scrolling pane
    // rather than `fixed`, which would leave the grid it has to stay aligned to.
    expect(dataTable).toContain('sticky top-0');
    /*
     * `overflow-auto`, both axes. It was `overflow-y-auto` until #393 gave the
     * grid a min-width floor so `30-responsive.md`'s `768 → Horizontal scroll`
     * had something to scroll; the horizontal overflow that floor creates has
     * to land in this pane, because the surface above it is `overflow-hidden`
     * and the document must not scroll sideways at any width (#389).
     */
    // Anchored on the pane's own class string, not the bare word: `overflow-auto`
    // also appears in this file's prose, so `toContain('overflow-auto')` stays
    // green against a revert to `overflow-y-auto`.
    expect(dataTable).toContain("'min-h-0 flex-1 overflow-auto'");
    /*
     * And the frame is the `md`-and-up branch. Frame `13` draws a table at
     * 1440; below 768 the same rows render as the card list the degradation
     * table asks for, so a parity read of this file is reading the branch the
     * frame describes.
     */
    expect(dataTable).toContain('hidden min-w-full md:block');
  });

  /*
   * `TABLE_MIN_WIDTH_PX` is a hand-computed product of five facts that live in
   * three other files, and nothing else ties them together — move the rail or
   * the surface's gutters and the constant is silently wrong in one of two
   * directions: a scrollbar at 1024, which the contract draws without one, or
   * the collapse #393 closed reopening at 768. So the derivation is recomputed
   * here from those files rather than restated, and this test is the thing that
   * fails when one of them moves.
   */
  it('floors the grid at the width the shell actually leaves it at 1024', () => {
    const railContent = Number(
      /--sidebar-admin-width: ([\d.]+)rem/.exec(themeCss)?.[1] ?? Number.NaN,
    );
    expect(railContent).toBeGreaterThan(0);

    /*
     * Anchored on the exact class strings, because `toContain('px-3')` is
     * satisfied by `px-3.5` and `toContain('lg:border-r')` by `lg:border-r-2` —
     * both of which move the rail's footprint and neither of which would have
     * failed. The arithmetic below still names 12 and 1 by hand; these anchors
     * are what force whoever changes them to come here and change those too.
     */
    expect(nav).toContain('bg-stone-0 px-3 py-2 lg:box-content');
    expect(nav).toContain('lg:border-r lg:border-b-0');
    const rail = railContent * 16 + 12 * 2 + 1;

    // `AdminSurface`'s pane gutters, and the table's own hairline either side.
    expect(surface).toContain('overflow-hidden px-6 pb-4');
    expect(dataTable).toContain('rounded-panel border border-stone-300 bg-stone-0');
    const smallLaptop = 1024;
    const expected = smallLaptop - rail - 24 * 2 - 1 * 2;

    const declared = Number(/TABLE_MIN_WIDTH_PX = (\d+)/.exec(dataTable)?.[1] ?? Number.NaN);
    expect(declared).toBe(expected);
    // Corroborated in the browser on 2026-09-05: all six admin tables render
    // 739px wide at 1024, and 739 against a 718px pane at 768.
    expect(declared).toBe(739);
  });

  /*
   * `CardList` drops the truncation from the cell **wrapper** below 768,
   * because a card has nothing to widen and no pane to scroll. A cell that sets
   * `white-space: nowrap` on a child of its own is out of that wrapper's reach,
   * and the card silently elides again with no way to read the rest — which is
   * exactly what `tag-table.tsx`'s rename button did: at 390 a 100-character
   * tag name (`updateTagSchema`'s ceiling) measured `clientWidth 186 /
   * scrollWidth 425`.
   *
   * So a table's own cells may truncate from `md` up and not below it. Every
   * such class in the seven tables must carry a breakpoint.
   */
  it('lets no table cell truncate below the card breakpoint', () => {
    // Numbered rather than named groups: this package targets below ES2018.
    const truncating = /([\w-]+:)?(truncate|text-ellipsis|whitespace-nowrap|line-clamp-\d+)/g;

    // Every file that declares columns for `DataTable`. Not the primitive
    // itself: its truncation lives on the grid branch, which `md:` already
    // gates as a whole.
    const columnSources = [
      'src/components/admin/activity-table.tsx',
      'src/components/admin/review-table.tsx',
      'src/components/admin/tag-table.tsx',
      'src/components/admin/vendor-table.tsx',
      'src/app/admin/bookings/page.tsx',
      'src/app/admin/customers/page.tsx',
      // #432 moved the Payments columns into a client component with them.
      'src/components/admin/payment-table.tsx',
    ];
    expect(columnSources).toHaveLength(7);

    for (const path of columnSources) {
      // Comments discuss these classes by name; only the code declares them.
      const code = read(path)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');

      for (const match of code.matchAll(truncating)) {
        expect(
          match[1],
          `${path}: \`${match[0]}\` truncates at every width, so the card list elides it`,
        ).toBe('md:');
      }
    }
  });

  it('fixes the header row and scrolls the body, not the page (continued)', () => {
    /*
     * The pane that scrolls, owned by the shell rather than copied into each
     * screen — and nothing shares it. The pager sat in this box for one commit
     * and cost the table 45px, which is one 44px row, so "fifteen rows fit"
     * stopped being true at the first page that needed a pager.
     */
    expect(surface).toContain(
      '<div className="min-h-0 flex-1 overflow-hidden px-6 pb-4">{children}</div>',
    );
    // The pager is inside the title block, above the pane that scrolls.
    const pagerAt = surface.indexOf('<Pager {...pager}');
    const paneAt = surface.indexOf('<div className="min-h-0 flex-1 overflow-hidden px-6 pb-4">');
    expect(pagerAt).toBeGreaterThan(-1);
    expect(pagerAt).toBeLessThan(paneAt);
  });

  it('sets the header row’s ground and micro-label off the frame', () => {
    expect(frame).toContain("background:#F4F0E8;font:600 10.5px 'Instrument Sans'");
    expect(themeCss).toContain('--color-stone-100: #f4f0e8');
    expect(themeCss).toContain('--text-label: 10.5px');
    // The app's standing micro-label idiom, and `--tracking-label` is the
    // frame's own `.05em` rather than an arbitrary value beside it.
    expect(themeCss).toContain('--tracking-label: 0.05em');
    expect(dataTable).toContain('bg-stone-100');
    expect(dataTable).toContain('text-label font-semibold tracking-label text-stone-600 uppercase');
  });

  it('holds rows at 44px with the frame’s zebra and separator', () => {
    expect(frame).toContain('height:44px;border-bottom:1px solid #F1ECE4');
    expect(frame).toContain('background:#FDFAF4');
    expect(themeCss).toContain('--color-stone-150: #f1ece4');
    expect(themeCss).toContain('--color-stone-25: #fdfaf4');
    // h-11 is 44px.
    expect(dataTable).toContain('h-11 items-center gap-3 border-b border-stone-150');
    expect(dataTable).toContain('bg-stone-25');
  });

  it('names the seven columns the frame names', () => {
    for (const column of ['Business', 'Category', 'City', 'Rating', 'Bookings', 'Status']) {
      expect(frame, column).toContain(`<span>${column}</span>`);
      expect(vendorTable, column).toContain(`header: '${column}'`);
    }
  });
});

describe('the status pills', () => {
  /** Every `.pill` the frame draws, as `[label, fill, text]`. */
  function pillsInFrame(): [string, string, string][] {
    return [
      ...frame.matchAll(
        /class="pill" style="background:(#[0-9A-F]{6});color:(#[0-9A-F]{6})">([^<]+)/g,
      ),
    ].map((match) => [match[3] as string, match[1] as string, match[2] as string]);
  }

  it('draws exactly the four statuses `22-admin.md` names', () => {
    expect(new Set(pillsInFrame().map(([label]) => label))).toEqual(
      new Set(['Live', 'Review', 'Flagged', 'Paused']),
    );
  });

  it('maps each to the shared pill vocabulary rather than to a new colour', () => {
    /*
     * The frame's own pairs, and the `STATUS_TONES` entry each resolves to. The
     * acceptance criterion is "every status uses the shared pill vocabulary" —
     * so what this asserts is that the frame's colours *are* already in that
     * vocabulary, not that the console reproduced them by hand.
     */
    const expected: Record<string, [string, string, string]> = {
      Live: ['confirmed', '--color-sage-50: #edf0e9', '--color-sage-600: #4b5940'],
      Review: ['pending', '--color-gold-50: #f5eedc', '--color-gold-600: #7a5a12'],
      Flagged: ['needsYou', '--color-clay-100: #f7e7e0', '--color-clay-600: #8e3f20'],
      Paused: ['inert', '--color-stone-200: #efe9e0', '--color-stone-600: #6b6459'],
    };

    for (const [label, fill, text] of pillsInFrame()) {
      const [tone, fillToken, textToken] = expected[label] as [string, string, string];

      expect(themeCss, `${label} fill`).toContain(fillToken);
      expect(themeCss, `${label} text`).toContain(textToken);
      expect(fillToken.toLowerCase(), `${label} fill`).toContain(fill.toLowerCase());
      expect(textToken.toLowerCase(), `${label} text`).toContain(text.toLowerCase());
      /*
       * Tone and word are asserted in the two places they now live. The needle
       * carries its trailing comma so it matches the map entry and not a
       * mention of the same word in the prose beside it.
       */
      const status = label.toLowerCase();
      expect(vendorTable, label).toContain(`${status}: '${tone}',`);
      expect(statusLabels, label).toContain(`${status}: '${label}',`);
    }
  });

  /*
   * `Retired` is the one status the frame does not draw, because the state did
   * not exist when frame `13` was cut (#433). It is asserted here rather than
   * left to the frame loop above so that its absence from the frame reads as a
   * recorded deviation instead of as a gap — and so that it cannot quietly
   * acquire a colour the design never specified. It shares `Paused`'s `inert`:
   * the frame's vocabulary for a storefront that is not trading.
   */
  it('gives the retired status no colour the frame did not already draw', () => {
    expect(pillsInFrame().map(([label]) => label)).not.toContain('Retired');
    expect(vendorTable).toContain("retired: 'inert',");
    expect(statusLabels).toContain("retired: 'Retired',");
  });

  /*
   * The pill's *box*, which `#392` measured at 47.36x26 against the frame's
   * 44.88x23 on every surface that draws one — not only the console.
   *
   * This is the miss that was a plan correction rather than a component fix:
   * `px-2.5 py-1.5 text-xs` is what `03-components.md` prescribes, so the
   * component was obeying the plan and the plan disagreed with the frame. Design
   * law is that the frame wins, so both moved. `03-components.md` is asserted
   * here too, or the next pass reads the old vocabulary and re-lands the defect.
   */
  it('sizes the pill off `.pill`, and keeps the plan saying the same thing', () => {
    const pillRule = frameRule('.pill');

    expect(pillRule).toContain("font:700 10px 'Instrument Sans'");
    expect(pillRule).toContain('letter-spacing:.07em');
    expect(pillRule).toContain('padding:5px 10px');
    expect(pillRule).toContain('border-radius:999px');

    // 10px is a step of its own: `--text-xs` is 11 and `--text-label` is 10.5.
    expect(themeCss).toContain('--text-pill: 10px');

    const box = 'rounded-full px-2.5 py-[5px] text-pill font-bold tracking-[.07em] uppercase';
    expect(read('src/components/ui/status-pill.tsx')).toContain(box);
    expect(read('../../design/design-plan/03-components.md')).toContain(box);
  });
});

describe('what the parity pass measured, kept from drifting back', () => {
  const avatar = read('src/components/ui/avatar.tsx');
  const rowTrigger = read('src/components/admin/row-trigger.tsx');
  const filterBar = read('src/components/admin/filter-bar.tsx');
  const logo = read('src/components/brand/logo.tsx');

  it('lets a caller override the avatar’s tone', () => {
    /*
     * `cn` is tailwind-merge, so the later of two conflicting classes wins.
     * Folding `className` into `shared` and appending the tone after it dropped
     * the caller's override entirely — frame `13`'s inverted header avatar came
     * out clay-on-cream, the brightest thing on a near-black bar.
     */
    expect(avatar).not.toMatch(/const shared = cn\([\s\S]*?\n\s+className,\n\s+\);/);
    expect(avatar).toContain('FALLBACK_TONES[avatarToneIndex(name)],\n        className,');
  });

  it('keeps a body cell’s colour out of the header label', () => {
    /*
     * `text-stone-900` on the business column leaked into `BUSINESS`, which the
     * frame draws in `stone-600` like the other five. The header cell takes
     * `headerClassName` and nothing from `className` — `truncate` beside it is
     * the header's own (`#389`), and carries no colour.
     */
    expect(dataTable).toContain("cn('truncate', column.headerClassName)");
    expect(vendorTable).not.toContain("headerClassName: 'font-semibold text-stone-900'");
  });

  it('does not clip a focus ring inside a cell', () => {
    /*
     * A ring is drawn outside the element's box and every control fills its
     * cell exactly, so a bare `truncate` cut three of four sides off. The first
     * fix added `overflow-clip-margin` and left `overflow: hidden` — where that
     * property is **silently ignored**, so nothing changed. It only applies to
     * `overflow: clip`.
     */
    expect(dataTable).toContain('overflow-clip text-ellipsis');
    expect(dataTable).toContain('[overflow-clip-margin:6px]');
    expect(dataTable).not.toMatch(/overflow-hidden[^']*\[overflow-clip-margin/);
  });

  it('gives both row controls a 44px-tall target', () => {
    /*
     * `04-laws.md` asks 44x44 of an icon-only control; they were 32x32 and
     * 14x14. The `···` fills its 70px cell and right-aligns its glyph, which is
     * where the frame draws it. The checkbox takes the row's full height but
     * cannot take 44px of width: frame `13` gives that column a **22px** track,
     * so a wider target would overlap the business name. Recorded in the ticket
     * as a frame-versus-law question rather than resolved by widening the
     * column, which would be a composition change.
     */
    expect(rowTrigger).toContain('h-11 w-full items-center justify-end');
    expect(vendorTable).toContain('flex h-11 w-full cursor-pointer items-center justify-start');
  });

  it('clears the floating bulk bar by its own measured height', () => {
    /*
     * The bar is `bottom-4` (16px) and 55px tall, so the last row needs 71px to
     * scroll past it. `pb-16` gave 64 and left row 15's two 44px controls 5px
     * under the bar — visible, but `elementFromPoint` returned the bar, so both
     * hit targets were 39px.
     *
     * All three numbers are pinned, including the bar's `py-2.5`. Its 55px is
     * emergent — no literal spells it — so pinning only the padding and the
     * offset would let a future ticket bump the bar to `py-6`, take the
     * clearance to −17px, and reinstate the exact defect under a green guard.
     */
    expect(dataTable).toContain("scrollPadding && 'pb-20'");
    expect(vendorTable).toContain(
      'absolute inset-x-4 bottom-4 z-20 flex items-center gap-3 rounded-lg border border-stone-300 bg-stone-0 px-4 py-2.5',
    );
  });

  it('sets the header cluster’s gap and mark at the frame’s measured sizes', () => {
    /*
     * Both were read off a *rendered* frame `13` rather than its markup: the
     * mark is 22 x 15 and the cluster gap is 9px. `gap-1` with a 14.375 mark
     * put the `Admin` chip at x=103.5 against the frame's x=110 — drift that
     * survives a source read because neither side writes the resolved value.
     */
    // `shrink-0` since `#389`: the identity block on the other side of the bar
    // is the half that gives way when the header runs out of room, not this one.
    expect(header).toContain('flex shrink-0 items-center gap-[9px]');
    /*
     * The named size, not the literal 15 it holds — `LOGO_SIZES` exists "so no
     * surface picks a logo size by eye", and asserting the literal would make
     * *correcting* the call site fail this test.
     */
    expect(header).toContain('<Logo tone="dark" size={LOGO_SIZES.desktopHeader} />');
    expect(logo).toContain('desktopHeader: 15');
  });

  it('gives the search field the bordered-field focus treatment', () => {
    /*
     * `03-components.md` names three focus mechanisms and forbids mixing them.
     * A standalone bordered field darkens its own edge; with no override this
     * fell through to the global `:focus-visible` and painted the *unbordered*
     * control's detached offset ring on top of a border.
     */
    /*
     * Through `FIELD_FOCUS` since #383, so the string is written once for the
     * whole app — the same field type rendered three different rings while
     * every file spelled it out for itself. The pairing with `data-focus-own`
     * is what takes the base rule off; `components/focus-ring-guard.test.ts`
     * fails one without the other.
     */
    expect(filterBar).toContain('FIELD_FOCUS');
    expect(filterBar).toContain('data-focus-own');
  });

  it('draws the checkbox rather than leaving the OS to', () => {
    // `border-*` and `rounded-*` are inert while `appearance` is `auto`.
    expect(vendorTable).toContain('appearance-none rounded-[4px] border-[1.3px] border-stone-400');
  });

  it('declares no outline that `outline-style: none` would swallow', () => {
    for (const [name, source] of [
      ['row-trigger', rowTrigger],
      ['filter-bar', filterBar],
      ['data-table', dataTable],
      ['vendor-table', vendorTable],
    ] as const) {
      expect(source, name).not.toContain('focus-visible:outline-2');
    }
  });

  it('uses the app’s own dropdown, never a native select', () => {
    // `03-components.md`: "Never a native `date`, `time` or `select`."
    // Matched at the start of a line so the rule quoted in a docstring — which
    // necessarily contains the words — is not read as a violation of itself.
    for (const [name, source] of [
      ['filter-bar', filterBar],
      ['tag-queue', read('src/components/admin/tag-queue.tsx')],
    ] as const) {
      expect(source, name).toContain('SingleSelectDropdown');
      expect(source, name).not.toMatch(/^\s*<select$|^\s*<select /m);
    }

    // Every console component, whether or not it has a dropdown of its own.
    for (const file of ['tag-table', 'vendor-table', 'review-table', 'data-table']) {
      expect(read(`src/components/admin/${file}.tsx`), file).not.toMatch(
        /^\s*<select$|^\s*<select /m,
      );
    }
  });
});

describe('the title row and the Refine bar', () => {
  it('sets the heading at the frame’s 23px, not `.h2`’s 26px', () => {
    expect(frame).toContain('class="h2" style="font-size:23px">Vendors<');
    expect(surface).toContain('text-[23px]');
  });

  /*
   * The shell's three vertical paddings, which together decide whether the
   * fifteenth row fits — `22-admin.md`'s emphatic *fifteen*, and the one thing
   * it says to verify rather than assume.
   *
   * jsdom cannot measure the pane, so what is guarded here is the arithmetic's
   * inputs. The app was 2px over the frame at the top, 2px over at the bottom
   * of the title block, and 4px over in the pane: 8px, which is `(704 − 34) /
   * 45 = 14.89` rows against the frame's 15.07. `#385` named two of the three
   * and fixing only those would have left the block 2px tall (#416).
   */
  it('takes all three of the shell’s vertical paddings from the frame', () => {
    expect(frame).toContain('padding:16px 24px 12px');
    // The closing quote matters: without it `pb-3` is a prefix of `pb-3.5`, the
    // pre-#392 value, so the exact half-revert #416 was filed for stayed green.
    expect(surface).toContain('className="shrink-0 px-6 pt-4 pb-3"');

    expect(frame).toContain('flex:1;overflow:hidden;padding:0 24px 16px');
    expect(surface).toContain('overflow-hidden px-6 pb-4');

    expect(frame).toContain('justify-content:space-between;margin-bottom:14px');
    expect(surface).toContain('mb-3.5 flex items-baseline justify-between');
  });

  it('keeps the count line’s clauses and its separator', () => {
    expect(frame).toContain('412 total · 38 awaiting review · updated 2m ago');
    expect(vendorsPage).toContain('total`');
    expect(vendorsPage).toContain('awaiting review`');
    expect(surface).toContain("counts.join(' · ')");
  });

  it('keeps the frame’s literal control strings', () => {
    for (const literal of ['Search name, email or slug…', 'Export CSV']) {
      expect(frame, literal).toContain(literal);
      expect(vendorsPage, literal).toContain(literal);
    }
    expect(frame).toContain('Awaiting review (38)');
    expect(vendorsPage).toContain('Awaiting review ({vendors.awaitingReview})');
  });

  it('fills the saved filter with clay and paints Export CSV as clay text', () => {
    // `#B4552F` is the primary fill; `#A34A28` is clay as text. Never swapped.
    expect(frame).toContain('background:#B4552F;padding:8px 14px');
    expect(frame).toContain('color:#A34A28">Export CSV');
    expect(themeCss).toContain('--color-clay-400: #b4552f');
    expect(themeCss).toContain('--color-clay-500: #a34a28');
    expect(vendorsPage).toContain('bg-clay-400 text-stone-0');
    expect(vendorsPage).toContain('text-clay-500');
  });

  it('puts the filters in the bar rather than behind a modal', () => {
    for (const trigger of ['Category ▾', 'City ▾', 'Payouts ▾']) {
      expect(frame, trigger).toContain(trigger);
    }
    const filterBar = read('src/components/admin/filter-bar.tsx');
    expect(filterBar).toContain('method="get"');
    /*
     * The frame draws the caret and the app does not — **D25**, a user override
     * of the design contract rather than a parity failure. This assertion used
     * to read `toContain('▾')`, which is why it is inverted here rather than
     * deleted: an inverted assertion is the override stated as a check, so a
     * later parity pass restoring the glyph from the frame goes red instead of
     * quietly re-landing it. The frame half above is unchanged, because the
     * frame genuinely still draws it.
     */
    expect(filterBar).not.toContain('▾');
    // A `<dialog>` or a Radix modal anywhere in the bar would be the defect.
    expect(filterBar).not.toContain('Dialog');
  });
});
