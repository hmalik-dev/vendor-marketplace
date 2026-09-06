import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';

/*
 * Frames `20 Vendor dashboard empty` and `27 Vendor dashboard — empty · 1024`
 * (#371) — the unpublished dashboard, which the app had three deviations from.
 *
 * jsdom has no layout engine and this is a server component, so nothing here
 * renders it: the 1024 pass drove it in a browser against the draft fixture, as
 * the ticket required. What this guards is the three things a later edit can
 * silently undo — the banner existing at all, the pane's words, and the right
 * column being a card inside the pane rather than a rail beside it.
 */

const frames = readFileSync(
  join(process.cwd(), '..', '..', 'design', `${BRAND_NAME} - Screens.dc.html`),
  'utf8',
);

function frame(label: string): string {
  const start = frames.indexOf(`data-screen-label="${label}"`);
  expect(start, `frame "${label}" is missing from the design file`).toBeGreaterThan(-1);
  const next = frames.indexOf('data-screen-label="', start + 1);

  return frames.slice(start, next === -1 ? undefined : next);
}

/**
 * Source with its comments removed.
 *
 * Every assertion below is about what the screen *renders*, and these files
 * quote the frames at length in prose — including the sentence that must not
 * ship and the class that must not come back. Reading the raw file would fail on
 * the explanation of the rule rather than on a breach of it.
 */
function code(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const page = code('src/app/vendor/dashboard/page.tsx');
const checklist = code('src/components/vendor/publish-checklist.tsx');

const EMPTY_FRAMES = ['20 Vendor dashboard empty', '27 Vendor dashboard — empty · 1024'] as const;

describe('the unpublished dashboard names its cause in a gold banner', () => {
  it.each(EMPTY_FRAMES)('%s draws one', (label) => {
    expect(frame(label)).toContain('live yet');
  });

  it('is rendered above the payout banner, which is a different gate', () => {
    const blocker = page.indexOf('<PublishBlockerBanner');
    const payouts = page.indexOf('Payouts not connected');

    expect(blocker).toBeGreaterThan(-1);
    expect(payouts).toBeGreaterThan(blocker);
  });
});

describe('the empty pane says what the frame says', () => {
  it('takes its headline and its cause sentence from the 1024 frame', () => {
    const markup = frame('27 Vendor dashboard — empty · 1024');

    expect(markup).toContain('No requests yet');
    expect(markup).toContain('Nothing has come in because your listing is still a draft.');
    expect(page).toContain("'No requests yet'");
    expect(page).toContain("'Nothing has come in because your listing is still a draft.'");
  });

  /*
   * The 1440 frame's extra sentence is a platform statistic on a screen with
   * none to read. `.claude/rules/web-design-parity.md` forbids it outright, so
   * the deviation is deliberate and asserted rather than left to be re-found.
   */
  it('does not ship the 1440 frame’s invented market claim', () => {
    expect(frame('20 Vendor dashboard empty')).toContain('within a couple of weeks');
    expect(page).not.toContain('within a couple of weeks');
  });

  it('offers the frame’s control, and not a second copy of the banner’s', () => {
    expect(page).toContain('Preview my profile');
    expect(page).not.toContain('Finish your profile');
  });
});

describe('the checklist is a card inside the pane, not a rail beside it', () => {
  it.each(EMPTY_FRAMES)('%s draws it bordered on all four sides, with a radius', (label) => {
    const markup = frame(label);
    const rail = /border:1px solid #E4DDD1;border-radius:(\d+)px;padding:(\d+)px/.exec(markup);

    expect(rail, `frame "${label}" draws no bordered checklist card`).not.toBeNull();
  });

  it('is rendered as the pane’s right column, opposite the published rail', () => {
    expect(page).toContain('<PublishedRail dashboard={dashboard} serverToday={today} />');
    expect(page).toContain('<PublishChecklist dashboard={dashboard} />');
    // One shell: both columns sit inside the same flex row, so neither state
    // reaches the outer `border-l` rail frame `08` draws.
    expect(page).not.toMatch(/\}\s*\n\s*\{dashboard\.isPublished \? null : <PublishChecklist/);
  });

  it('carries the border, radius and padding the frames measure', () => {
    expect(checklist).toContain('rounded-2xl border border-stone-300');
    expect(checklist).toContain('p-4 ');
    expect(checklist).toContain('min-[90rem]:rounded-[18px]');
    expect(checklist).toContain('min-[90rem]:p-4.5');
    expect(checklist).not.toContain('border-l');
  });

  it('is 300 content-wide at 1024 and 340 at 1440, as the frames draw them', () => {
    expect(frame('27 Vendor dashboard — empty · 1024')).toContain('width:300px');
    expect(frame('20 Vendor dashboard empty')).toContain('width:340px');
    expect(checklist).toContain('w-[300px]');
    expect(checklist).toContain('min-[90rem]:w-[340px]');
    // `box-content`, because the frames are content-box: those are the numbers
    // inside the padding, not the outer widths.
    expect(checklist).toContain('lg:box-content');
  });
});
