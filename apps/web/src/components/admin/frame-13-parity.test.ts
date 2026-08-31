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

const frame = adminFrame();
const dataTable = read('src/components/admin/data-table.tsx');
const vendorTable = read('src/components/admin/vendor-table.tsx');
const header = read('src/components/admin/admin-header.tsx');
const nav = read('src/components/admin/admin-nav.tsx');
const surface = read('src/components/admin/admin-surface.tsx');
const vendorsPage = read('src/app/admin/vendors/page.tsx');

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

  it('marks the active item the way `.navA` does', () => {
    expect(frame).toContain('class="nav navA"');
    // `.navA{background:#F7E7E0;color:#8E3F20;font-weight:600;box-shadow:inset 3px 0 0 #B4552F}`
    expect(nav).toContain('bg-clay-100 font-semibold text-clay-600');
    expect(nav).toContain('shadow-[inset_3px_0_0_var(--color-clay-400)]');
  });
});

describe('the table', () => {
  it('uses one track list for the header row and the body rows', () => {
    // The frame repeats the same `grid-template-columns` on every row; here it
    // is written once and read twice, because two copies drift and the columns
    // stop lining up.
    expect(frame).toContain('grid-template-columns:22px 1.6fr 1.1fr 1fr .7fr .8fr .9fr 70px');
    expect(vendorTable).toContain("const TEMPLATE = '22px 1.6fr 1.1fr 1fr .7fr .8fr .9fr 70px'");
    expect(dataTable.match(/grid-cols-\(--admin-table-columns\)/g)).toHaveLength(2);
  });

  it('draws the surface, border and radius the frame draws', () => {
    expect(frame).toContain('background:#FFFDF9;border:1px solid #E4DDD1;border-radius:12px');
    expect(themeCss).toContain('--color-stone-300: #e4ddd1');
    expect(dataTable).toContain('rounded-xl border border-stone-300 bg-stone-0');
  });

  it('fixes the header row and scrolls the body, not the page', () => {
    // `22-admin.md`'s first acceptance line. `sticky` inside the scrolling pane
    // rather than `fixed`, which would leave the grid it has to stay aligned to.
    expect(dataTable).toContain('sticky top-0');
    expect(dataTable).toContain('overflow-y-auto');
    expect(surface).toContain('min-h-0 flex-1 overflow-hidden');
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
      expect(vendorTable, label).toContain(`{ tone: '${tone}', label: '${label}' }`);
    }
  });
});

describe('the title row and the Refine bar', () => {
  it('sets the heading at the frame’s 23px, not `.h2`’s 26px', () => {
    expect(frame).toContain('class="h2" style="font-size:23px">Vendors<');
    expect(surface).toContain('text-[23px]');
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
    expect(filterBar).toContain('▾');
    // A `<dialog>` or a Radix modal anywhere in the bar would be the defect.
    expect(filterBar).not.toContain('Dialog');
  });
});
