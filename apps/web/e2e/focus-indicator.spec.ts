import { expect, test } from './fixtures.js';
import { E2E_VENDOR_SLUG } from './fixtures-data.js';

import type { Page } from '@playwright/test';

/**
 * One focus indicator per keyboard stop, everywhere (#383).
 *
 * The user's report was *"multiple (including an outdated focus) on the
 * inputs… verify it across the app that that issue doesnt persist"*, and the
 * acceptance it was filed with is explicit that a class-list assertion cannot
 * see this failure. It cannot: `ring-*`, `inset-ring-*`, `ring-offset-*` and
 * `outline` are four different properties composited into two, so a component
 * that looks like it overrode the base rule painted its own indicator *and*
 * whatever it did not override. A plain text input measured three concentric
 * edges that way; the search bar stacked four.
 *
 * So this reads the **rendered** result: Tailwind's ring custom properties and
 * the outline, off every element the Tab key actually reaches, walking up to
 * `<body>` because an indicator is legitimately painted by an ancestor (a
 * vendor card rings for the link inside it, a search segment fills for its
 * combobox). One focus event, one indicator, wherever it is drawn.
 *
 * It is deliberately driven with the keyboard rather than `element.focus()`:
 * `:focus-visible` does not match a programmatic focus on a button, so a
 * scripted pass would measure nothing at all and report a clean run.
 */

/**
 * How many Tab presses to spend on one route before moving on.
 *
 * Generous on purpose: the vendor profile puts `review-form` and
 * `availability-calendar` — both changed by #383 — below a header, a tab strip,
 * a gallery and the packages pane, and a walk that stopped at 45 never reached
 * either while `report` still passed.
 */
const MAX_STOPS = 90;

/**
 * A ring shadow that paints nothing — unset, or declared at zero width.
 *
 * The second form is what `ring-offset-0` leaves: `0 0 0 0px #f8f5ef`, a real
 * declaration covering no pixels. Reading only the unset form called that an
 * offset band and failed a control that has none.
 */
const PAINTS_NOTHING = /^0 0 (?:#0000|rgba\(0, 0, 0, 0\))$|^0 0 0 0px\b/;

interface Stop {
  /** A human-readable path to the focused element, for a failure message. */
  where: string;
  /** Indicators painted on the focused element and every ancestor of it. */
  indicators: string[];
  /** Set when the indicator is drawn outside a clipping ancestor's rect. */
  clipped: string | null;
}

/**
 * Read the focus stop the browser is currently on.
 *
 * Everything is measured inside one `evaluate` so the whole chain is sampled in
 * a single tick — and `transition` is read too, because `.claude/rules`
 * records four separate findings from reading an animating ring once and
 * quoting the keyframe as a fact. The transitions on these elements are on
 * `color`/`background-color`, never on `box-shadow`, which
 * `focus-ring-guard.test.ts` enforces; this asserts the shape, not a number.
 */
async function readStop(page: Page): Promise<Stop | null> {
  return page.evaluate((): Stop | null => {
    const active = document.activeElement;

    if (!active || active === document.body || !(active instanceof HTMLElement)) {
      return null;
    }

    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : '';
      const slot = element.getAttribute('data-slot');
      const label = element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30);
      // Enough of the class list to find the element in the source.
      const classes = element.className.toString().split(/\s+/).filter(Boolean).slice(0, 4);

      return (
        `${tag}${id}${slot === null ? '' : `[${slot}]`}` +
        `${label ? ` "${label}"` : ''}${classes.length > 0 ? ` .${classes.join('.')}` : ''}`
      );
    };

    /**
     * A Tailwind ring custom property that paints nothing.
     *
     * Two shapes, and both matter. `0 0 #0000` is the unset value; `0 0 0 0px
     * <colour>` is what `ring-offset-0` leaves behind — a real declaration at
     * zero width, which draws no pixels and must not be read as an indicator.
     */
    const EMPTY = /^0 0 (?:#0000|rgba\(0, 0, 0, 0\))$|^0 0 0 0px\b/;

    const indicators: string[] = [];
    let clipped: string | null = null;
    const chain: Element[] = [];

    for (
      let node: Element | null = active;
      node && node !== document.body;
      node = node.parentElement
    ) {
      chain.push(node);
      const style = getComputedStyle(node);

      /*
       * `--tw-ring-shadow` and `--tw-ring-offset-shadow` are one indicator
       * together: the offset band exists only to separate the ring from the
       * control. An offset with no ring is not an indicator, it is a defect,
       * and it is exactly what a component that overrode `ring-*` alone was
       * left holding — so it is counted and named.
       */
      const ring = style.getPropertyValue('--tw-ring-shadow').trim();
      const offset = style.getPropertyValue('--tw-ring-offset-shadow').trim();
      const insetRing = style.getPropertyValue('--tw-inset-ring-shadow').trim();

      if (ring !== '' && !EMPTY.test(ring)) {
        indicators.push(`ring on ${describe(node)}: ${ring}`);
      } else if (offset !== '' && !EMPTY.test(offset)) {
        indicators.push(`a bare ring-offset with no ring on ${describe(node)}: ${offset}`);
      }

      if (insetRing !== '' && !EMPTY.test(insetRing)) {
        indicators.push(`inset ring on ${describe(node)}: ${insetRing}`);
      }

      if (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) {
        indicators.push(
          `outline on ${describe(node)}: ${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
        );
      }

      /*
       * The segment treatment is a fill, and a fill is an indicator. Without
       * this the floor below would read every correctly-indicated search
       * segment as a control with nothing on it.
       */
      if (
        node.hasAttribute('data-focus-fill') &&
        style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        style.backgroundColor !== 'transparent'
      ) {
        indicators.push(`fill on ${describe(node)}: ${style.backgroundColor}`);
      }
    }

    /*
     * `04-laws.md`: "the focus ring has to be visible, not merely declared".
     * An outward indicator on an element that exactly fills an `overflow:hidden`
     * ancestor is 100% outside that ancestor's rect and paints nothing, while
     * every computed value reads correctly — which is how the vendor card went
     * without a keyboard indicator on the two busiest screens in the app.
     */
    const drawn = chain.find((node) => {
      const style = getComputedStyle(node);
      const ring = style.getPropertyValue('--tw-ring-shadow').trim();

      return (
        (ring !== '' && !EMPTY.test(ring)) ||
        (style.outlineStyle !== 'none' &&
          Number.parseFloat(style.outlineWidth) > 0 &&
          Number.parseFloat(style.outlineOffset) >= 0)
      );
    });

    if (drawn !== undefined) {
      const box = drawn.getBoundingClientRect();

      for (
        let node = drawn.parentElement;
        node && node !== document.body;
        node = node.parentElement
      ) {
        const style = getComputedStyle(node);

        if (style.overflowX === 'visible' && style.overflowY === 'visible') {
          continue;
        }

        const clip = node.getBoundingClientRect();

        /*
         * Per axis, and **only** where that axis cannot scroll.
         *
         * A pane that scrolls vertically shows every one of its children at
         * some scroll position, and the browser scrolls a focused control into
         * view — so a control that happens to sit at the pane's top edge in
         * this sample is not a clipped indicator, it is a scroll position. The
         * profile editor's category chips read -0.09px that way. The axis that
         * cannot be scrolled out of is the one where zero slack means the ring
         * is drawn outside the clip and is never on screen; that is the failure
         * `04-laws.md` names, and the vendor card and the messages list are
         * both instances of it.
         */
        const axes: [number, boolean][] = [
          [
            Math.min(box.left - clip.left, clip.right - box.right),
            node.scrollWidth > node.clientWidth,
          ],
          [
            Math.min(box.top - clip.top, clip.bottom - box.bottom),
            node.scrollHeight > node.clientHeight,
          ],
        ];

        const stuck = axes.find(([slack, scrollable]) => !scrollable && slack <= 0);

        if (stuck !== undefined) {
          clipped = `${describe(drawn)} has ${stuck[0]}px of slack inside ${describe(node)}`;
          break;
        }
      }
    }

    return { where: describe(active), indicators, clipped };
  });
}

/**
 * Tab through a page, gathering every stop.
 *
 * Bounded by `MAX_STOPS` alone. It used to claim it also stopped when focus
 * returned to where it started, and it never did — the key it compared included
 * the loop index, so the set could not match twice. The claim is gone rather
 * than implemented: nothing here needs it, and a safety property that does not
 * hold is worse than one that was never promised.
 */
async function walk(page: Page, settled?: string): Promise<Stop[]> {
  /*
   * Clerk mounts its form after hydration, so `/sign-in` had two keyboard stops
   * — the skip link and the logo — at the moment the walk began. That is a page
   * that has not finished arriving, and measuring it reports a clean run for
   * every control it never reached.
   */
  if (settled !== undefined) {
    await page.locator(settled).first().waitFor({ state: 'visible' });
  }

  await page.locator('body').click({ position: { x: 2, y: 2 } });

  const stops: Stop[] = [];

  for (let index = 0; index < MAX_STOPS; index += 1) {
    await page.keyboard.press('Tab');

    let stop = await readStop(page);

    if (stop === null) {
      break;
    }

    /*
     * The segment fill is a `transition-colors` property, so a stop read in the
     * same tick as the Tab can legitimately show none of it yet. Only the
     * *empty* reading is re-taken, which costs one wait per genuinely
     * unindicated stop rather than one per stop.
     */
    if (stop.indicators.length === 0) {
      await page.waitForTimeout(300);
      stop = (await readStop(page)) ?? stop;
    }

    stops.push(stop);
  }

  return stops;
}

/**
 * A colour read once, mid-transition, is a keyframe reported as a fact.
 *
 * These controls carry `transition-colors`, which in Tailwind v4 covers
 * `border-color` and `background-color` — the two properties the treatments
 * below are asserted on. Reading them in the same tick as the focus gave
 * `rgb(228, 220, 208)` for a border that settles on `clay-400`: the start of the
 * ramp, indistinguishable from the bug. `.claude/rules/web-design-parity.md`
 * records four separate findings from exactly this.
 *
 * So: sample until two consecutive reads agree. That is the whole guard, and it
 * is what makes the number below a measurement rather than a sample.
 */
async function settledStyle<T>(page: Page, read: () => Promise<T>): Promise<T> {
  let previous = JSON.stringify(await read());

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.waitForTimeout(50);
    const current = await read();
    const encoded = JSON.stringify(current);

    if (encoded === previous) {
      return current;
    }

    previous = encoded;
  }

  throw new Error(`a style never settled after 20 samples: last was ${previous}`);
}

function report(route: string, stops: Stop[]): void {
  expect(stops.length, `no element on ${route} took keyboard focus`).toBeGreaterThan(3);

  const doubled = stops
    .filter((stop) => stop.indicators.length > 1)
    .map((stop) => `${route} → ${stop.where}\n    ${stop.indicators.join('\n    ')}`);

  expect(doubled, 'these keyboard stops paint more than one focus indicator').toEqual([]);

  /*
   * The floor, and it matters as much as the ceiling.
   *
   * The mechanism #383 introduces fails in **two** directions: paint two
   * indicators, or opt out with `data-focus-own` and then paint none. The
   * second is the quieter one — it looks correct in every class list and in
   * review — and a gate that only counted downwards could not see it. It was
   * real: the combobox's sheet mount renders its field in a portal where no
   * segment is an ancestor, so opting out there left the primary control of the
   * mobile search with no keyboard indicator at all.
   */
  const bare = stops
    .filter((stop) => stop.indicators.length === 0)
    .map((stop) => `${route} → ${stop.where}`);

  expect(bare, 'these keyboard stops paint no focus indicator at all').toEqual([]);

  const invisible = stops
    .filter((stop) => stop.clipped !== null)
    .map((stop) => `${route} → ${stop.where}: ${stop.clipped ?? ''}`);

  expect(invisible, 'these focus indicators are clipped out of view').toEqual([]);
}

/** Route, and a selector that proves the page has finished arriving. */
const SIGNED_OUT: [string, string | undefined][] = [
  ['/', undefined],
  ['/search', undefined],
  [`/vendors/${E2E_VENDOR_SLUG}`, undefined],
  ['/sign-in', '.cl-formFieldInput'],
];

test.describe('one focus indicator per keyboard stop', () => {
  for (const [route, settled] of SIGNED_OUT) {
    test(`signed out on ${route}`, async ({ page }) => {
      await page.goto(route);
      report(route, await walk(page, settled));
    });
  }

  for (const route of ['/bookings', '/customer/profile', '/messages']) {
    test(`as a customer on ${route}`, async ({ customerPage }) => {
      await customerPage.goto(route);
      report(route, await walk(customerPage));
    });
  }

  for (const route of [
    '/vendor/dashboard',
    '/vendor/profile/edit',
    '/vendor/bookings',
    // `switch.tsx` changed here and appears on no other route in this list.
    '/vendor/packages',
  ]) {
    test(`as a vendor on ${route}`, async ({ vendorPage }) => {
      await vendorPage.goto(route);
      report(route, await walk(vendorPage));
    });
  }

  /*
   * The two treatments that are not the base rule, asserted by name on a
   * representative control each — so a future change that quietly collapses all
   * three back into one fails here rather than only looking different.
   */
  test('gives a bordered field the tight ring and no offset band', async ({ customerPage }) => {
    await customerPage.goto('/customer/profile');

    /*
     * A text input matches `:focus-visible` on a programmatic focus — the
     * heuristic only withholds it from buttons and links — so this needs no
     * keyboard dance, and the Shift+Tab/Tab one it had was landing on the
     * control *before* this field and measuring that instead.
     */
    const field = customerPage.locator('input[data-slot="input"]').first();
    await field.focus();

    const style = await settledStyle(customerPage, () =>
      field.evaluate((element) => {
        const computed = getComputedStyle(element);

        return {
          ring: computed.getPropertyValue('--tw-ring-shadow').trim(),
          offset: computed.getPropertyValue('--tw-ring-offset-shadow').trim(),
          outline: computed.outlineStyle,
          border: computed.borderTopColor,
        };
      }),
    );

    expect(style.ring).not.toBe('');
    expect(style.ring).toContain('3px');
    // The bordered treatment has no offset band, and darkens the edge instead.
    expect(style.offset).toMatch(PAINTS_NOTHING);
    expect(style.outline).toBe('none');
    expect(style.border).toBe('rgb(180, 85, 47)');
  });

  /*
   * Clerk's own controls, which the base rule reaches and `data-focus-own`
   * cannot: `globals.css` restates each treatment unlayered for them, and the
   * text field is the one that has to zero the offset by hand.
   */
  test('gives the auth form the bordered treatment, offset band and all', async ({ page }) => {
    await page.goto('/sign-in');

    const field = page.locator('.cl-formFieldInput').first();
    await field.waitFor({ state: 'visible' });
    await field.focus();

    const style = await settledStyle(page, () =>
      field.evaluate((element) => {
        const computed = getComputedStyle(element);

        return {
          ring: computed.getPropertyValue('--tw-ring-shadow').trim(),
          offset: computed.getPropertyValue('--tw-ring-offset-shadow').trim(),
          border: computed.borderTopColor,
          outline: computed.outlineStyle,
        };
      }),
    );

    expect(style.ring).toContain('3px');
    // `ring-offset-0` on Clerk's field leaves a real declaration at zero width.
    expect(style.offset).toMatch(PAINTS_NOTHING);
    expect(style.border).toBe('rgb(180, 85, 47)');
    expect(style.outline).toBe('none');
  });

  test('gives a search segment a fill and nothing else', async ({ page }) => {
    await page.goto('/search');

    const segment = page.locator('input[data-slot="combobox-input"]').first();
    await segment.focus();

    const stop = await readStop(page);

    expect(stop?.indicators ?? ['not focused']).toEqual([]);

    /*
     * The colour itself, not a boolean about it. Settling on `field === target`
     * returns the moment two mid-ramp samples agree, which they do immediately
     * — both are `false`. The raw value is what actually stops moving.
     */
    const filled = await settledStyle(page, () =>
      segment.evaluate((element) => {
        const field = element.closest('[data-slot="combobox-field"]');

        return field === null ? 'no segment ancestor' : getComputedStyle(field).backgroundColor;
      }),
    );

    // `stone-200`, the fill `03-components.md` § Inputs gives a bar segment.
    expect(filled).toBe('rgb(239, 233, 224)');

    const labelColour = await settledStyle(page, () =>
      segment.evaluate((element) => {
        const label = element.closest('[data-slot="combobox-field"]')?.querySelector('label');

        return label === null || label === undefined ? 'no label' : getComputedStyle(label).color;
      }),
    );

    // "…and a clay label" — `clay-600`, the token for text on a tinted surface.
    expect(labelColour).toBe('rgb(142, 63, 32)');
  });
});
