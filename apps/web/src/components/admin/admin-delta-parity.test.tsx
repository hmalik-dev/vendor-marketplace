import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// `AdminNav` reads the active route; jsdom has none.
vi.mock('next/navigation', () => ({ usePathname: () => '/admin/cases' }));
import {
  BOOKING_PRESENTATION,
  REQUEST_PRESENTATION,
  PAYOUT_PRESENTATION,
} from '@/lib/booking-entries';
import { ageTone, CASE_PRESENTATION } from '@/lib/case-presentation';
import { STATUS_TONES } from '@/components/ui/status-pill';
import { ActivityTable } from './activity-table';
import { AdminNav } from './admin-nav';
import type { WireAdminActivityRow } from '@/lib/wire-schemas';

/*
 * `design/delta-admin/` vs the console, on the axes jsdom can settle (#454).
 *
 * The same contract as `frame-13-parity.test.ts` and the same reasoning: the
 * expectations are read out of the bundle where the bundle states them, so a
 * re-cut bundle moves the target rather than silently disagreeing with a number
 * written down here. What this file guards is the drift a browser pass is worst
 * at catching — a track list edited in one of the two places it is used, a
 * column reordered, a status quietly taking a neighbouring tone.
 *
 * The three corrections ruled while this bundle landed are asserted **against
 * the bundle's own correction block**, not against a copy of them here, for the
 * same reason.
 */

const deltaDirectory = join(process.cwd(), '../../design/delta-admin');
const prompt = readFileSync(join(deltaDirectory, 'ADMIN-VIEWS-PROMPT.md'), 'utf8');
/*
 * Found by suffix rather than named, the way `frame-13-parity.test.ts` finds
 * the screens document: the bundle's filename carries the brand, and
 * `brand-literals.test.ts` forbids that literal anywhere under `apps/web/src`.
 */
const drawnFile = readdirSync(deltaDirectory).filter((entry) =>
  entry.endsWith('-Admin-Views.html'),
);

if (drawnFile.length !== 1) {
  throw new Error(`Expected exactly one drawn admin bundle, found ${drawnFile.length}`);
}

const drawn = readFileSync(join(deltaDirectory, drawnFile[0] as string), 'utf8');

/** A source file with its comments removed, so a guard cannot match its own prose. */
function sourceWithoutComments(relative: string): string {
  return readFileSync(join(process.cwd(), relative), 'utf8').replace(
    /\{?\/\*[\s\S]*?\*\/\}?|^\s*\/\/.*$/gm,
    '',
  );
}

afterEach(cleanup);

describe('the rail', () => {
  /*
   * Rendered, not grepped.
   *
   * `admin-nav.tsx` carries a paragraph explaining that Cases sits after
   * Bookings, so a `toContain('Cases')`-shaped guard over that file passes on
   * the sentence and cannot fail for a row in the wrong place. This asserts the
   * order the browser receives.
   */
  function railLabels(): string[] {
    render(<AdminNav reviewCount={6} caseCount={23} />);

    return screen.getAllByRole('link').map((link) => link.textContent?.replace(/\d+$/, '') ?? '');
  }

  it('renders the nine rows in the order the delta draws them', () => {
    expect(railLabels()).toEqual([
      'Overview',
      'Vendors',
      'Customers',
      'Bookings',
      'Cases',
      'Payments',
      'Reviews',
      'Categories & tags',
      'Activity',
    ]);
  });

  /*
   * The frame's own rail, so the assertion above is measured against the
   * drawing rather than against a transcription of it. Both `.nav` lists in the
   * bundle (Pattern B's frame and Pattern C's) draw the same nine.
   */
  it('draws the same order the bundle draws, in both of its frames', () => {
    const rails = [...drawn.matchAll(/<div class="side">([\s\S]*?)<\/div>\s*<div style="flex:1/g)];
    expect(rails.length).toBe(2);

    for (const [, markup] of rails) {
      const labels = [...(markup as string).matchAll(/class="nav(?: navA)?">([^<]+)/g)].map(
        (match) => (match[1] as string).trim(),
      );

      expect(labels).toEqual([
        'Overview',
        'Vendors',
        'Customers',
        'Bookings',
        'Cases',
        'Payments',
        'Reviews',
        'Categories &amp; tags',
        'Activity',
      ]);
    }
  });

  /*
   * The count change the delta's stale preamble invites. It argues the rail
   * "needs nine" from a brief of eight; #431 had already given Cases its row,
   * so a reader who acts on that sentence adds a tenth.
   */
  it('is nine rows, because the move was an order change and not a count change', () => {
    expect(railLabels()).toHaveLength(9);
  });

  /** Badges on Cases and Reviews only — a badge on a row that is never zero is decoration. */
  it('badges Cases and Reviews and nothing else', () => {
    render(<AdminNav reviewCount={6} caseCount={23} />);

    const badged = screen
      .getAllByRole('link')
      .filter((link) => /\d$/.test(link.textContent ?? ''))
      .map((link) => link.textContent);

    expect(badged).toEqual(['Cases23', 'Reviews6']);
  });

  /** `/admin/requests` is a tab of Bookings, not a row. That surface is #437's. */
  it('gives /admin/requests no row', () => {
    render(<AdminNav reviewCount={6} caseCount={23} />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).not.toContain('/admin/requests');
  });

  /**
   * Correction 2: the route stays `/admin/tags`.
   *
   * The bundle names `/admin/categories` and nothing drawn depends on the path;
   * a rename breaks operator bookmarks and every `admin_actions` subject link
   * already written against the old one.
   */
  it('serves the taxonomy at /admin/tags, and the bundle records why', () => {
    render(<AdminNav reviewCount={0} caseCount={0} />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/admin/tags');
    expect(hrefs).not.toContain('/admin/categories');
    expect(prompt).toContain('**The route stays `/admin/tags`.**');
  });
});

const ACTIVITY_ROW: WireAdminActivityRow = {
  id: '11111111-1111-4111-8111-111111111111',
  actorId: '22222222-2222-4222-8222-222222222222',
  actorName: 'Dana Okafor',
  action: 'user_banned',
  subjectType: 'booking',
  subjectId: '33333333-3333-4333-8333-333333333333',
  detail: {},
  createdAt: new Date('2026-09-07T14:02:00.000Z'),
};

describe('/admin/activity against Pattern A', () => {
  function activityGrid(): string {
    const { container } = render(
      <ActivityTable path="/admin/activity" filtered={false} rows={[ACTIVITY_ROW]} />,
    );
    const grid = container.querySelector<HTMLElement>('[style*="--admin-table-columns"]');
    expect(grid).not.toBeNull();

    return (grid as HTMLElement).style.getPropertyValue('--admin-table-columns').trim();
  }

  /**
   * The grid, read off the DOM rather than the source, and including the fifth
   * column the bundle does not list.
   *
   * **Correction 1**: `What changed` is kept. The paragraph forbidding a
   * rounded timestamp forbids this harder — a trail recording that something
   * changed but not what fails the same test. Its width is the one it had; the
   * delta draws none for it.
   */
  it('lays out Actor, Action, Subject, What changed, When', () => {
    expect(activityGrid()).toBe(
      'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1.7fr) minmax(0, .9fr)',
    );
  });

  it('takes the four flexible tracks the bundle states for them', () => {
    const stated =
      /Actor (\S+) · Action (\S+) · Subject (\S+) · What changed (\S+) ·\s*\n?\s*When (\S+)`/.exec(
        prompt,
      );
    expect(stated, 'Pattern A no longer states the activity grid').not.toBeNull();

    const [, actor, action, subject, detail, when] = stated as RegExpExecArray;
    expect(activityGrid()).toBe(
      [actor, action, subject, detail, when].map((track) => `minmax(0, ${track})`).join(' '),
    );
  });

  it('heads the actor column Actor, the word the delta uses', () => {
    render(<ActivityTable path="/admin/activity" filtered={false} rows={[ACTIVITY_ROW]} />);

    expect(screen.getAllByText('Actor').length).toBeGreaterThan(0);
    expect(screen.queryByText('Operator')).toBeNull();
  });

  /**
   * Subject is type + id in **one** cell, and the two halves are drawn
   * differently within it — type `stone-600`, id mono `stone-900`.
   *
   * The cell was uniformly mono `stone-700`, so `Booking` and its id read as
   * one undifferentiated string and the eye could not sort by type down the
   * column. Asserted on the two spans rather than on the cell's text, because
   * the text was already correct while the typography was not.
   */
  it('renders Subject as a type and an id, drawn apart', () => {
    const { container } = render(
      <ActivityTable path="/admin/activity" filtered={false} rows={[ACTIVITY_ROW]} />,
    );

    const type = container.querySelector('a span.text-stone-600');
    const id = container.querySelector('a span.font-mono.text-stone-900');

    expect(type?.textContent).toBe('Booking');
    expect(id?.textContent).toBe('33333333');
  });

  /**
   * Absolute to the minute, on a 24-hour clock — the delta draws `14:02`.
   *
   * The two differences from the frame are deliberate and recorded in
   * `web-design-parity.md`: it prints `Sep 7` where the frame draws `7 Sep`,
   * because `31-content-voice.md` rules the product US English; and it keeps
   * the zone, which the frame's mock timestamp does not address either way.
   */
  it('stamps a 24-hour clock, never a 12-hour one and never a relative one', () => {
    render(<ActivityTable path="/admin/activity" filtered={false} rows={[ACTIVITY_ROW]} />);

    const stamp = screen.getAllByText(/Sep 7, 2026/)[0]?.textContent ?? '';

    expect(stamp).toContain('14:02');
    expect(stamp).toContain('UTC');
    expect(stamp).not.toMatch(/\bPM\b|\bAM\b/);
    expect(stamp).not.toMatch(/ago/);
  });
});

describe('/admin/cases against Pattern A', () => {
  const page = sourceWithoutComments('src/app/admin/cases/page.tsx');

  /**
   * The grid, from the page source with its comments stripped.
   *
   * The stripping is what makes this able to fail: the page explains why
   * `Filed` was dropped and names the columns while doing it, so against the
   * raw file a `not.toContain('Filed')` guard matches the explanation and
   * passes whatever the table renders.
   */
  it('lays out Reference, Sender, Subject, Booking, Age, Status at the drawn tracks', () => {
    const columns = [
      ...page.matchAll(/key: '(\w+)',\s*\n?\s*width: '([^']+)',\s*\n?\s*header: '([^']*)'/g),
    ].map((match) => [match[3], match[2]]);

    expect(columns).toEqual([
      ['Reference', '.9fr'],
      ['Sender', '1.2fr'],
      ['Subject', '1.8fr'],
      ['Booking', '.9fr'],
      ['Age', '.6fr'],
      ['Status', '.8fr'],
    ]);
  });

  it('drops Filed, whose question Age now answers', () => {
    expect(page).not.toContain("header: 'Filed'");
    expect(page).not.toContain('FILED');
  });

  it('renders a missing booking as a dash rather than a blank', () => {
    expect(page).toContain('<span className="text-stone-600">—</span>');
  });

  /**
   * The default the queue exists for, and it must survive this change (#431).
   *
   * Open and oldest first: the top row is the case that has been waiting
   * longest, which is the only ordering an operator can defend. Asserted on the
   * two places that set it rather than on the rendered list, which is paginated
   * on the server.
   */
  it('keeps open and oldest-first as the default', () => {
    const query = readFileSync(
      join(process.cwd(), '../../packages/shared/src/schemas/index.ts'),
      'utf8',
    );

    expect(query).toMatch(/status:[\s\S]{0,200}?default\('open'\)/);
    expect(page).toContain("const showing = status ?? 'open'");
  });

  /**
   * Age's colour, over the whole threshold table rather than one case.
   *
   * Red here is the SLA failing, not the case — the distinction the delta makes
   * explicitly, and the reason this does not contradict `40-states.md`.
   */
  it.each([
    [0, 'text-stone-900'],
    [1, 'text-gold-600'],
    [2, 'text-gold-600'],
    [3, 'text-error-500'],
    [40, 'text-error-500'],
  ])('colours a %id-old case %s', (days, expected) => {
    expect(ageTone(days as number)).toBe(expected);
  });
});

/*
 * Acceptance 5, as a table over **every** status the delta names.
 *
 * A single `expired` assertion is the shape this repo keeps being caught by: it
 * passes while five siblings are wrong, because the defect being guarded is a
 * whole-vocabulary mistake rather than one entry. `40-states.md` is the law —
 * steel information, gold waiting on someone, red failed, sage settled — and
 * the delta only draws its consequences.
 */
describe('the delta colour vocabulary', () => {
  const tone = (className: string): string => {
    const family = /text-(\w+)-\d+/.exec(className);

    return (family?.[1] ?? 'unknown').replace('error', 'red');
  };
  const toneOf = (entry: { tone: keyof typeof STATUS_TONES } | undefined): string =>
    tone(STATUS_TONES[entry?.tone as keyof typeof STATUS_TONES] ?? '');

  /**
   * Every status the delta's table names, with the colour **this console
   * draws** and whether that agrees with the delta.
   *
   * The fourth column is the point. Two entries disagree with the bundle, and
   * both are ruled overrides rather than transcription — writing the code's
   * value into a table headed "what the delta rules" is how a test comes to
   * verify the falsehood it was written to catch.
   */
  const DELTA_STATUSES: ReadonlyArray<readonly [string, string, string, 'agrees' | 'override']> = [
    ['request', 'pending', 'gold', 'agrees'],
    ['request', 'quoted', 'steel', 'override'],
    ['request', 'accepted', 'clay', 'override'],
    ['request', 'declined', 'stone', 'agrees'],
    ['request', 'cancelled', 'stone', 'agrees'],
    ['request', 'expired', 'stone', 'agrees'],
    ['booking', 'confirmed', 'sage', 'agrees'],
    ['booking', 'completed', 'sage', 'agrees'],
    ['booking', 'cancelled', 'stone', 'agrees'],
    ['booking', 'disputed', 'red', 'agrees'],
    ['case', 'open', 'gold', 'agrees'],
    ['case', 'resolved', 'sage', 'agrees'],
    ['payout', 'pending', 'gold', 'agrees'],
    ['payout', 'held', 'clay', 'agrees'],
    ['payout', 'released', 'sage', 'agrees'],
  ];

  const MAPS: Record<string, Record<string, { tone: keyof typeof STATUS_TONES }>> = {
    request: REQUEST_PRESENTATION,
    booking: BOOKING_PRESENTATION,
    case: CASE_PRESENTATION,
    payout: PAYOUT_PRESENTATION,
  };

  it.each(DELTA_STATUSES)('draws a %s %s in %s', (domain, status, expected) => {
    const entry = MAPS[domain as string]?.[status as string];
    expect(entry, `${domain} ${status} has no presentation`).toBeDefined();
    expect(toneOf(entry)).toBe(expected);
  });

  /**
   * The one every implementation gets wrong, called out on its own because the
   * table above would still pass if it were the only row that was right.
   *
   * A clock running out is not a failure. Nothing was refused, nobody did
   * anything wrong, and the request simply has no time left.
   */
  it('draws expired stone, never red', () => {
    expect(toneOf(REQUEST_PRESENTATION.expired)).toBe('stone');
  });

  /**
   * Red is reserved, and this reads it out of the **presentation maps** rather
   * than out of the table above.
   *
   * The version this replaces filtered `DELTA_STATUSES` for its own `'red'`
   * literals and asserted on the result — a tautology that could not fail for
   * any change to any tone, because nothing it touched came from the product.
   * This walks every entry of all four maps and names the ones that resolve to
   * red, so a status quietly taking `failed` fails here by appearing in the
   * list.
   *
   * `40-states.md` reserves red for failure, and in this delta exactly three
   * things have failed: a **payout attempt**, a **chargeback**, and a **dispute
   * reason**. Only one of the three is a *status* in these maps — a booking's
   * `disputed`. The other two are not statuses at all, which is why they are
   * asserted separately below rather than wedged into a status table.
   */
  it('spends red on no status but a disputed booking', () => {
    const red = Object.entries(MAPS).flatMap(([domain, map]) =>
      Object.entries(map)
        .filter(([, entry]) => toneOf(entry) === 'red')
        .map(([status]) => `${domain} ${status}`),
    );

    expect(red).toEqual(['booking disputed']);
  });

  /**
   * The delta's other two reds, which are flags rather than statuses.
   *
   * A payout attempt that failed and a dispute reason are the two the table
   * above structurally cannot cover, and leaving them out of the acceptance
   * because of that would be a coverage gap dressed as a scope decision.
   */
  /**
   * The clock is 24-hour on **both** screens that print a time, not only the
   * one the delta names.
   *
   * Pattern C draws `opened 4 Sep 2026, 09:12`, the case detail is one click
   * from `/admin/activity`, and a console that switched conventions between
   * two adjacent screens would be worse than either alone. The case detail
   * printed `12:16 AM` until the parity pass measured it.
   */
  it('keeps a 24-hour clock on the case detail as well as the activity log', () => {
    const caseDetail = sourceWithoutComments('src/app/admin/cases/[caseId]/page.tsx');

    expect(caseDetail).toContain('hour12: false');
    expect(caseDetail).not.toContain("timeStyle: 'short'");
  });

  it('draws a failing payout red, and the dispute reason red', () => {
    const paymentTable = sourceWithoutComments('src/components/admin/payment-table.tsx');
    expect(paymentTable).toContain('<StatusPill tone="failed">{PAYOUT_FAILING_LABEL}</StatusPill>');

    const caseDetail = sourceWithoutComments('src/app/admin/cases/[caseId]/page.tsx');
    expect(caseDetail).toMatch(/disputeReason[\s\S]{0,600}text-error-500/);
  });

  /**
   * A private tone map is how a screen comes to disagree with the law.
   *
   * `/admin/cases/[caseId]` carried its own `PAYOUT_TONES` mapping `held` to
   * **`failed`** — red — while the shared `PAYOUT_PRESENTATION` maps it to
   * `needsYou`. The parity pass caught it; the table above could not, because
   * the table reads the shared map and the screen did not.
   *
   * Red on a hold is a `40-states.md` violation and not a taste question: the
   * delta spends red on a failed payout attempt, a chargeback and a dispute
   * reason, and a hold is none of them — it is deliberate, correct, and drawn
   * gold. The shared map's own docstring says exactly what the copy did wrong:
   * *"painting it as a failure would tell an operator to fix something that is
   * working."*
   *
   * So the guard is that the screen has **no second map at all**, which is a
   * stronger claim than any assertion about what a second map contains.
   */
  it('reads the shared payout map rather than a private one', () => {
    const caseDetail = sourceWithoutComments('src/app/admin/cases/[caseId]/page.tsx');

    expect(caseDetail).toContain('PAYOUT_PRESENTATION[booking.payoutStatus].tone');
    expect(caseDetail).not.toContain('PAYOUT_TONES');
    expect(caseDetail).not.toContain('PAYOUT_LABELS');
    // The value the copy got wrong, asserted where it is now read from.
    expect(toneOf(PAYOUT_PRESENTATION.held)).toBe('clay');
  });

  /**
   * The two places this console diverges from the delta's colour table, each
   * **ruled** rather than left open, and recorded in `web-design-parity.md`.
   *
   * Both are the same shape and were settled the same way: the delta is an
   * *admin* bundle, and these pills are drawn on the customer hub and the
   * request detail as well as the console. `/admin/requests`, the only surface
   * where the delta would show either, does not exist yet and is #437's — so
   * restyling three customer screens on an admin bundle's authority is an
   * adjudication rather than a parity fix, and the product-wide file wins.
   *
   * - **`quoted` stays steel.** `03-components.md` rules `QUOTED steel-50 /
   *   steel-600`; the delta's table says gold. Ruled 2026-09-07 by the account
   *   holder: `03-components.md` stands and the bundle's table is corrected as
   *   transcription drift under D30.
   * - **`accepted` stays clay.** The delta calls it *settled* and colours it
   *   sage. `needsYou` is the only tone that spends clay and it means *waiting
   *   on this user* — an accepted request is waiting on the customer to pay,
   *   which is the whole reason the hub draws it that way.
   *
   * These assertions pin the ruled values and cross-check each against the file
   * that rules it, so neither is a test pinning a copy of the code it grades.
   */
  it('keeps quoted steel and accepted clay, against the delta, as ruled', () => {
    expect(toneOf(REQUEST_PRESENTATION.quoted)).toBe('steel');
    expect(toneOf(REQUEST_PRESENTATION.accepted)).toBe('clay');

    const components = readFileSync(
      join(process.cwd(), '../../design/design-plan/03-components.md'),
      'utf8',
    );
    expect(components).toMatch(/\| QUOTED\s+\|\s+`steel-50`/);

    const rules = readFileSync(
      join(process.cwd(), '../../.claude/rules/web-design-parity.md'),
      'utf8',
    );
    expect(rules).toContain('`quoted` stays steel');
    expect(rules).toContain('`accepted` stays clay');
  });
});

/*
 * The defect a count cannot catch: a widening whose link leads nowhere.
 *
 * `/admin/cases` is the one console screen where a filter has **no "any"
 * URL** — `adminCaseQuerySchema` defaults `status` to `open`, which is why the
 * filter bar deliberately offers no `Any status` choice. A widening built as a
 * plain drop therefore renders `/admin/cases`, and on the default view that is
 * the page it was offered from: a filled primary button promising rows, that
 * re-renders the identical empty state, next to a `Clear all filters` link
 * pointing at the same URL. Both exits dead.
 *
 * **The counts never disagreed** — the page is empty exactly when the current
 * status contributes nothing, so the drop and the switch total the same. Only
 * the destination was wrong, which is why it is asserted here rather than in
 * the API suite.
 */
describe('a widening always leads somewhere', () => {
  const cases = sourceWithoutComments('src/app/admin/cases/page.tsx');

  it('sends the case queue status route to the other status, not to no status', () => {
    // The `carried` object is what `adminQueryString` builds the href from; a
    // `status` absent from it is a link back to the default view.
    expect(cases).toContain('carried: { status: other, booking }');
    expect(cases).toContain("const other = showing === 'open' ? 'resolved' : 'open'");
  });

  /**
   * And the label follows the destination. `Any status` was the words for the
   * broken version; a switch says which status it switches to, which is what
   * the delta draws — `Open cases instead (4)`.
   */
  it('names the status it switches to', () => {
    expect(cases).toContain('cases instead`');
    expect(cases).not.toContain("widening: 'Any status'");
  });
});

describe('the corrections this bundle landed with', () => {
  /**
   * Correction 3, and the reason it is asserted at all: a frame in the
   * repository saying suspension "holds payouts", sitting beside code that
   * refunds in full, would be read by the next lane as the spec — and would
   * change what a suspension does to somebody's money without anyone deciding
   * to. Holding is reversible and leaves the customer's money where it is; a
   * full refund is neither.
   */
  it('does not leave the frame saying suspension holds payouts', () => {
    const actionsCard = drawn.slice(
      drawn.indexOf('<span class="btnD"'),
      drawn.indexOf('Every state change is logged'),
    );

    expect(actionsCard).toContain('Suspend vendor');
    expect(actionsCard).toContain('refunded in full');
    expect(actionsCard).not.toContain('holds payouts');
  });

  it('records all three corrections in the bundle rather than only in a commit', () => {
    expect(prompt).toContain('## Corrections — ruled 2026-09-07 while landing this bundle (#454)');
    expect(prompt).toContain('`/admin/activity` keeps its `What changed` column');
    expect(prompt).toContain('**The route stays `/admin/tags`.**');
    expect(prompt).toContain('**Suspending a vendor refunds in full. It does not hold payouts.**');
  });

  /**
   * Acceptance 11. `#449` turns on whether a bundle is border-box, and this one
   * is the delta that is not — zero `box-sizing` declarations, universal or
   * inline, which puts it with the screens document and against the other three
   * delta bundles. A measurement taken off it corroborates the *opposite* side
   * to the one its provenance suggests.
   *
   * **The rule half is asserted on the substance, not on a sentence.** It was a
   * `toContain` of the exact wording this ticket first wrote, and #449's ruling
   * then landed on main saying the same thing better — *"two content-box
   * documents against three border-box bundles"* — so a rebase that correctly
   * took the newer paragraph turned the guard red. A parity test that pins
   * prose verbatim fails when somebody improves the sentence, which is a guard
   * on the wrong thing and trains the next reader to loosen it carelessly. What
   * has to hold is that the file names this bundle **and** says it ships no
   * reset, in whatever words.
   */
  it('is content-box, and the parity rules record that beside #449', () => {
    expect(drawn).not.toContain('box-sizing');

    const rules = readFileSync(
      join(process.cwd(), '../../.claude/rules/web-design-parity.md'),
      'utf8',
    );

    const paragraph = rules.slice(rules.indexOf('#449'), rules.indexOf('#419'));
    expect(paragraph, 'the #449 paragraph no longer mentions delta-admin').toContain('delta-admin');
    expect(paragraph).toMatch(/no reset|content-box|zero `box-sizing`/);
  });
});
