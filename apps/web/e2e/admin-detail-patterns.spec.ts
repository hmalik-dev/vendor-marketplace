import { test as base, type Page } from '@playwright/test';

import { resolveE2EApiUrl } from './base-url.js';
import { expect, expectSignedIn, storageStatePath } from './fixtures.js';
import { waitForHydration } from './hydration.js';

/**
 * The two console detail screens against `design/delta-admin/` Patterns B and C
 * (VEN-393), on the axes jsdom cannot settle: column geometry and computed type.
 *
 * Everything here is read off `getComputedStyle` and `getBoundingClientRect`,
 * never off class names — a class that exists but loses to another in the
 * cascade renders the wrong thing with the right markup. Each measurement also
 * asserts extent, because a radius on a zero-height box has passed on nothing.
 */

const API_URL = resolveE2EApiUrl();

const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, provide) => {
    const context = await browser.newContext({
      storageState: storageStatePath('admin'),
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto('/admin');
    await expectSignedIn(page);
    await provide(page);
    await context.close();
  },
});

/** What every detail card, band and label/value row computes to, page-wide. */
async function measureDetail(page: Page) {
  return page.evaluate(() => {
    const interactive =
      'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]';
    const cards = [...document.querySelectorAll<HTMLElement>('[data-admin-card]')];

    return {
      cards: cards.map((card) => {
        const style = getComputedStyle(card);
        const band = card.querySelector<HTMLElement>('[data-card-band]');
        const bandStyle = band ? getComputedStyle(band) : null;

        return {
          title: card.querySelector('h2')?.textContent ?? '',
          height: card.getBoundingClientRect().height,
          radius: style.borderTopLeftRadius,
          bandFirst: card.firstElementChild === band,
          bandPadding: bandStyle
            ? `${bandStyle.paddingTop} ${bandStyle.paddingRight} ${bandStyle.paddingBottom} ${bandStyle.paddingLeft}`
            : null,
          bandBottom: bandStyle
            ? `${bandStyle.borderBottomWidth} ${bandStyle.borderBottomStyle}`
            : null,
          readOnlyControls: card.hasAttribute('data-read-only')
            ? card.querySelectorAll(interactive).length
            : null,
        };
      }),
      lists: [...document.querySelectorAll<HTMLElement>('[data-admin-card] dl')]
        .filter((list) => list.querySelector(':scope > dd[data-kind]'))
        .map((list) => ({
          columns: getComputedStyle(list).gridTemplateColumns,
          labelWidth: list.querySelector('dt')?.getBoundingClientRect().width ?? 0,
        })),
      values: [...document.querySelectorAll<HTMLElement>('dd[data-kind]')].map((value) => {
        const style = getComputedStyle(value);

        return {
          kind: value.dataset.kind,
          text: value.textContent ?? '',
          size: style.fontSize,
          mono: /JetBrains Mono/.test(style.fontFamily),
          width: value.getBoundingClientRect().width,
        };
      }),
    };
  });
}

type Measured = Awaited<ReturnType<typeof measureDetail>>;

/** Acceptance 4, 5 and 6, which hold on both screens in the same words. */
function expectSharedPieces(measured: Measured, { hasFields }: { hasFields: boolean }): void {
  expect(measured.cards.length).toBeGreaterThan(1);

  for (const card of measured.cards) {
    expect(card.height, `${card.title} has no extent`).toBeGreaterThan(30);
    expect(card.radius, card.title).toBe('12px');
    expect(card.bandFirst, card.title).toBe(true);
    expect(card.bandPadding, card.title).toBe('10px 16px 10px 16px');
    expect(card.bandBottom, card.title).toBe('1px solid');
  }

  const readOnly = measured.cards.filter((card) => card.readOnlyControls !== null);
  expect(readOnly.length).toBeGreaterThan(0);
  expect(Object.fromEntries(readOnly.map((card) => [card.title, card.readOnlyControls]))).toEqual(
    Object.fromEntries(readOnly.map((card) => [card.title, 0])),
  );

  /*
   * A support message names no booking and no subject, so its case page has no
   * label/value list at all; the users page always has one. Stated per screen
   * rather than skipped silently, so a page that lost its lists still fails.
   */
  expect(measured.lists.length > 0).toBe(hasFields);
  for (const list of measured.lists) {
    expect(list.columns.split(' ')[0]).toBe('150px');
    expect(list.labelWidth).toBe(150);
  }

  const mono = measured.values.filter((value) => value.kind === 'mono');
  const text = measured.values.filter((value) => value.kind === 'text');
  expect(mono.length > 0).toBe(hasFields);
  for (const value of mono) {
    expect(value.width, value.text).toBeGreaterThan(0);
    expect({ text: value.text, size: value.size, mono: value.mono }).toEqual({
      text: value.text,
      size: '12px',
      mono: true,
    });
  }
  for (const value of text) {
    expect({ text: value.text, size: value.size, mono: value.mono }).toEqual({
      text: value.text,
      size: '13px',
      mono: false,
    });
  }
}

test('/admin/users/[userId] draws Pattern B', async ({ adminPage: page }) => {
  await page.goto('/admin/customers');
  const href = await page.locator('a[href^="/admin/users/"]').first().getAttribute('href');
  expect(href, 'no customer rows — the lane seed is missing').not.toBeNull();

  await page.goto(href as string);
  await waitForHydration(page, '[data-detail-aside] button');

  const layout = await page.evaluate(() => {
    const aside = document.querySelector<HTMLElement>('[data-detail-aside]');
    const record = aside?.previousElementSibling as HTMLElement | null;
    const box = (element: Element | null | undefined) => element?.getBoundingClientRect();

    return {
      aside: box(aside)?.width,
      asideLeft: box(aside)?.left,
      recordRight: box(record)?.right,
      asideCards: [...(aside?.querySelectorAll(':scope > [data-admin-card] h2') ?? [])].map(
        (heading) => heading.textContent,
      ),
      tiers: [...document.querySelectorAll('[data-action-tier]')].map(
        (tier) =>
          tier.querySelector('button')?.textContent ?? tier.querySelector('span')?.textContent,
      ),
      hairline: (() => {
        const tier = document.querySelector('[data-action-tier]');
        const rule = tier?.nextElementSibling as HTMLElement | null;

        return rule
          ? {
              height: rule.getBoundingClientRect().height,
              bg: getComputedStyle(rule).backgroundColor,
            }
          : null;
      })(),
    };
  });

  expect(layout.aside).toBe(320);
  expect(layout.asideLeft as number).toBeGreaterThan(layout.recordRight as number);
  expect(layout.asideCards).toEqual(['Identity', 'Actions']);
  expect(layout.tiers[0]).toBe('Export data');
  expect(layout.tiers[1]).toMatch(/^(Close account|Closed \d{4}-\d{2}-\d{2})$/);
  // `stone-150`, 1px — the tier hairline.
  expect(layout.hairline).toEqual({ height: 1, bg: 'rgb(241, 236, 228)' });

  expectSharedPieces(await measureDetail(page), { hasFields: true });
});

test('/admin/cases/[caseId] draws Pattern C, with the resolve control past the evidence', async ({
  adminPage: page,
}) => {
  const message = `E2E pattern C ${Date.now().toString(36)} — the vendor did not arrive.`;
  const filed = await page.request.post(`${API_URL}/support/messages`, {
    data: { topic: 'something-else', email: 'pattern-c@example.com', message },
  });
  /*
   * A lane's mail service may refuse the send. The case is filed either way —
   * the reference is issued before the send is attempted and a refusal carries
   * it in `details` — and a refused send is a case the console must still show.
   */
  const body = (await filed.json()) as { reference?: string; details?: { reference?: string } };
  const reference = body.reference ?? body.details?.reference;
  expect(reference, `filing a case answered ${filed.status()}: ${JSON.stringify(body)}`).toMatch(
    /^ORL-/,
  );

  await page.goto('/admin/cases');
  const row = page.locator('a[href^="/admin/cases/"]', { hasText: reference }).first();
  await expect(row).toBeVisible();
  await page.goto((await row.getAttribute('href')) as string);
  await waitForHydration(page, '[data-admin-card] button');

  const layout = await page.evaluate(() => {
    const card = (title: string) =>
      [...document.querySelectorAll<HTMLElement>('[data-admin-card]')].find(
        (candidate) => candidate.querySelector('h2')?.textContent === title,
      );
    const complaint = card('1 · The complaint');
    const thread = card('Reported thread');
    const resolve = card('3 · Resolve');
    const box = (element?: HTMLElement) => element?.getBoundingClientRect();
    const inset = complaint?.querySelector<HTMLElement>('[data-message-inset]');
    const insetStyle = inset ? getComputedStyle(inset) : null;
    const control = resolve?.querySelector('button');

    return {
      complaint: box(complaint),
      thread: box(thread),
      resolve: box(resolve),
      grid: getComputedStyle(complaint?.parentElement as HTMLElement).gridTemplateColumns,
      chip: thread?.querySelector('[data-card-band]')?.textContent,
      sender: complaint
        ?.querySelector('[data-sender] [data-slot="avatar-fallback"]')
        ?.getBoundingClientRect().width,
      inset: insetStyle && {
        bg: insetStyle.backgroundColor,
        border: `${insetStyle.borderTopWidth} ${insetStyle.borderTopColor}`,
        radius: insetStyle.borderTopLeftRadius,
        padding: `${insetStyle.paddingTop} ${insetStyle.paddingLeft}`,
        text: inset?.textContent,
      },
      // DOCUMENT_POSITION_FOLLOWING: the control comes after both regions it reads from.
      controlAfterComplaint: Boolean(
        control &&
        complaint &&
        complaint.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      controlAfterThread: Boolean(
        control &&
        thread &&
        thread.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    };
  });

  // Two columns at 1.35fr / 1fr: 1 and 3 share the left edge, the thread sits right.
  const [left, right] = layout.grid.split(' ').map(Number.parseFloat) as [number, number];
  expect(left / right).toBeCloseTo(1.35, 1);
  expect(layout.thread!.left).toBeGreaterThan(layout.complaint!.right);
  expect(layout.resolve!.left).toBe(layout.complaint!.left);
  expect(layout.resolve!.top).toBeGreaterThan(layout.complaint!.bottom);
  expect(layout.chip).toContain('Case-scoped read');

  expect(layout.sender).toBe(30);
  expect(layout.inset).toEqual({
    bg: 'rgb(248, 245, 239)',
    border: '1px rgb(239, 233, 224)',
    radius: '10px',
    padding: '13px 15px',
    text: message,
  });
  await expect(page.getByText(`${[...message].length} characters.`)).toBeVisible();

  expect(layout.controlAfterComplaint).toBe(true);
  expect(layout.controlAfterThread).toBe(true);

  expectSharedPieces(await measureDetail(page), { hasFields: false });
});
