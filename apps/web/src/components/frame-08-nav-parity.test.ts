import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The two sidebars the parity close-out settled — frame `08`'s vendor rail and
 * frame `07`'s customer one — on the axis a browser pass is worst at catching:
 * a row quietly renamed, or two rows swapped.
 *
 * **The expectations are read out of the frame at test time**, which is the
 * whole point of the file. `#300` asked for exactly this, and named the reason:
 * a set-equality assertion passes on a reordering, and a hard-coded list passes
 * on a re-cut frame that no longer says what the list says. Reading the frame's
 * own `.nav` rows in document order fails on both.
 *
 * Where the app deliberately departs from the frame it is asserted as a
 * *difference*, not skipped — `16-vendor-dashboard.md` and
 * `20-customer-bookings-hub.md` carry the rulings, and a test that simply
 * ignored the gap would go green again the day someone "fixed" it back.
 */

const designDirectory = join(process.cwd(), '../../design');
const framesFile = readdirSync(designDirectory).filter((entry) =>
  entry.endsWith('Screens.dc.html'),
);

if (framesFile.length !== 1) {
  throw new Error(`Expected exactly one screens frame file in design/, found ${framesFile.length}`);
}

const frames = readFileSync(join(designDirectory, framesFile[0] as string), 'utf8');

/** One frame's markup, from its label to the start of the next frame. */
function frame(label: string): string {
  const start = frames.indexOf(`data-screen-label="${label}"`);
  expect(start, label).toBeGreaterThan(-1);
  const next = frames.indexOf('data-screen-label=', start + 1);

  return frames.slice(start, next === -1 ? undefined : next);
}

/**
 * The sidebar rows a frame draws, in document order.
 *
 * The frames' rail rows are `<div class="nav">` / `<div class="nav navA">`, and
 * a row's label is its leading text — the count pill or unread dot that follows
 * is a nested element, so the label stops at the first `<`.
 */
function sidebarRows(label: string): string[] {
  const markup = frame(label);
  const side = markup.indexOf('class="side"');
  expect(side, label).toBeGreaterThan(-1);

  return [...markup.slice(side).matchAll(/<div class="nav(?: navA)?">([^<]*)/g)]
    .map((match) => (match[1] ?? '').trim())
    .filter((row) => row !== '');
}

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

/** The `label:` values of a nav item list, in source order. */
function labelsIn(source: string): string[] {
  return [...source.matchAll(/label: '([^']+)'/g)].map((match) => match[1] as string);
}

describe('frame 08 — the vendor rail', () => {
  const drawn = sidebarRows('08 Vendor dashboard');
  const built = labelsIn(read('src/components/vendor-nav.tsx'));

  /*
   * A floor before anything is compared, so a regex that stopped matching
   * cannot report "no differences" as a pass. This is the "before trusting a
   * check, ask what state would make it fail" rule: an empty list satisfies
   * every assertion below.
   */
  it('reads the frame at all', () => {
    expect(drawn).toEqual([
      'Dashboard',
      'Requests',
      'Bookings',
      'Messages',
      'Availability',
      'Packages',
      'Edit profile',
      'Payments',
    ]);
  });

  /*
   * **Order, not set membership.** Every row the app ships appears in the
   * frame's order — a swap of two rows fails here where a set comparison would
   * not, which is the failure `#79` was filed for and `#300` asked to be
   * guarded.
   */
  it('renders the frame rows it ships in the frame order', () => {
    const shared = built.filter((label) => drawn.includes(label));

    expect(shared).toEqual(drawn.filter((label) => built.includes(label)));
  });

  /*
   * `Requests` is the one frame row that is not built, and it is a ruling
   * rather than an omission: there is no `/vendor/requests` route and there
   * must not be one, because the `Dashboard` row above it *is* the requests
   * surface. Recorded in `16-vendor-dashboard.md`.
   */
  it('leaves out only Requests, which has nowhere to go', () => {
    expect(drawn.filter((label) => !built.includes(label))).toEqual(['Requests']);
  });

  /*
   * `Portfolio` and `Legal` are the reverse: live routes no frame draws. A rail
   * that omits a real surface strands it, so both ship — `Portfolio` beside
   * `Edit profile` because it is part of the same storefront, and `Legal`
   * because the vendor agreement it leads to is what gates the vendor's
   * payments (#427, frame `32`). Frame `08` predates both surfaces.
   */
  it('adds only the two routes the frame predates', () => {
    expect(built.filter((label) => !drawn.includes(label))).toEqual(['Portfolio', 'Legal']);
  });

  it('places Portfolio directly after Edit profile', () => {
    expect(built.indexOf('Portfolio')).toBe(built.indexOf('Edit profile') + 1);
  });

  /*
   * The rename `#300` asked for. `Business profile` is the string frame `27` —
   * the 1024 draft — writes, and `16-vendor-dashboard.md` already records that
   * frame's copy as *not* the contract.
   */
  it('calls the editor row what frame 08 calls it', () => {
    expect(built).toContain('Edit profile');
    expect(built).not.toContain('Business profile');
  });

  /*
   * `Messages` was held out under #31's rule that a control which opens nothing
   * is furniture. `/messages` ships, so the rule has expired for it — and the
   * href is asserted because a row that leads somewhere else is the same defect
   * wearing the right word.
   */
  it('points Messages at the route that now exists', () => {
    expect(read('src/components/vendor-nav.tsx')).toContain(
      "{ href: '/messages', label: 'Messages'",
    );
  });
});

describe('frame 07 — the customer rail', () => {
  const drawn = sidebarRows('07 Customer bookings hub');
  const built = labelsIn(read('src/components/bookings/bookings-sidebar.tsx'));

  it('reads the frame at all', () => {
    expect(drawn).toEqual(['My bookings', 'Messages', 'Saved vendors', 'My profile']);
  });

  it('renders the frame rows it ships in the frame order', () => {
    const shared = built.filter((label) => drawn.includes(label));

    expect(shared).toEqual(drawn.filter((label) => built.includes(label)));
  });

  /*
   * `Saved vendors` is the one row still held out, and for the reason it always
   * was: there is no saved-vendor feature anywhere in the product — no route,
   * no schema, no endpoint — so the row could only be a link to a 404.
   */
  it('leaves out only Saved vendors, which leads nowhere yet', () => {
    expect(drawn.filter((label) => !built.includes(label))).toEqual(['Saved vendors']);
  });

  it('adds nothing the frame does not draw', () => {
    expect(built.filter((label) => !drawn.includes(label))).toEqual([]);
  });
});

/**
 * Frame `19` draws a *different* rail around the same hub — a `Booking` section
 * label, a `Payments` row and an `Account` / `Settings` block. Ruled stale
 * 2026-09-06 in `20-customer-bookings-hub.md`: one shell, frame `07`'s, and the
 * pane swaps inside it.
 *
 * Asserted rather than ignored, because "the empty hub gets its own navigation"
 * is a change someone could reasonably make from frame `19` alone, and the
 * ruling is what says not to.
 */
describe('frame 19 — the shell that was overruled', () => {
  it('still draws the rail the app deliberately does not build', () => {
    expect(sidebarRows('19 Bookings hub empty')).toContain('Payments');
  });

  it('leaves no customer-facing Payments route for it to have opened', () => {
    const rules = read('src/lib/role-routes.ts');

    expect(rules).not.toContain("'/customer/payments'");
    expect(read('src/components/bookings/bookings-sidebar.tsx')).not.toContain('Payments');
  });
});
