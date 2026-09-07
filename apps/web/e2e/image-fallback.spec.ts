import { resolve } from 'node:path';

import { expect, test } from './fixtures.js';

import type { Page } from '@playwright/test';

/**
 * #422 — **a real load failure, not a nulled prop.**
 *
 * The component suites drive `fireEvent.error`, because jsdom fetches nothing
 * and performs no layout: they prove the handler is wired and the classes are
 * right, and they cannot prove either of the two things this ticket is actually
 * about. The whole defect was that the *absent* path worked while the *failure*
 * path did not, and a test that passes a missing `src` only ever exercises the
 * one that already worked.
 *
 * So this routes real image requests to a real 404 in Chromium, on both
 * rendering paths — `next/image` for the landing page's category art, a plain
 * `<img>` for the vendor's bucket cover — and then asserts two things that only
 * a browser can answer:
 *
 * 1. **No `<img>` survives the failure.** A failed image is not a styling
 *    question; it is a `naturalWidth` of 0, which is exactly what paints the
 *    browser's broken-image glyph. Zero of them is the acceptance.
 * 2. **The block has extent.** `web-design-parity.md`: a colour on an element
 *    of zero height has passed on nothing. Every block is measured, and the
 *    page's own height is compared before and after so a failure that silently
 *    collapsed the layout fails here rather than looking like a pass.
 */

/** Fail every image request the page makes, the way an R2 outage would. */
async function breakEveryImage(page: Page): Promise<void> {
  await page.route(
    (url) =>
      url.pathname.startsWith('/_next/image') || /\.(jpe?g|png|webp|avif|gif)$/i.test(url.pathname),
    (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' }),
  );
}

/** Images the browser has finished with and could not draw. */
async function brokenImages(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src || '(no src)'),
  );
}

/** Every fallback block on the page, with the box it actually occupies. */
async function fallbackBoxes(page: Page): Promise<Array<{ width: number; height: number }>> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-slot="image-fallback"]')).map((node) => {
      const box = node.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
}

/**
 * A real photograph to upload, rather than a fabricated buffer: the uploader
 * refuses anything under `MIN_UPLOAD_IMAGE_WIDTH`, so a 1x1 stub would be
 * rejected before it ever reached the bucket. This one already ships in the
 * repository as the Photography category's art.
 */
const SAMPLE_PHOTOGRAPH = resolve(__dirname, '../public/categories/photography.jpg');

/** The D17 ground, as the browser resolves `--color-stone-250`. */
const STONE_250 = 'rgb(236, 230, 220)';

test.describe('image fallback', () => {
  test('the landing page degrades its category art rather than breaking it', async ({ page }) => {
    /*
     * Measured with the photographs *working* first, so the comparison below
     * is against this page rather than against a number written down here.
     * A layout that shifts when an image fails is the reflow acceptance 3
     * forbids, and it cannot be seen without both readings.
     */
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const healthyHeight = await page.evaluate(() => document.body.scrollHeight);
    const healthyImages = await page.evaluate(() => document.images.length);

    expect(healthyImages, 'the landing page draws no images — nothing to fail').toBeGreaterThan(0);

    await breakEveryImage(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    /* Acceptance 1: no browser glyph anywhere on the front door. */
    await expect
      .poll(() => brokenImages(page), {
        message: 'images 404d and were left in the DOM as broken-image glyphs',
      })
      .toEqual([]);

    /* Acceptance 3: the blocks that replaced them hold a real box. */
    const boxes = await fallbackBoxes(page);

    expect(boxes.length, 'nothing rendered a fallback block').toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.width, 'a tone block on a zero-width box has replaced nothing').toBeGreaterThan(0);
      expect(box.height, 'a tone block on a zero-height box has replaced nothing').toBeGreaterThan(
        0,
      );
    }

    const brokenHeight = await page.evaluate(() => document.body.scrollHeight);

    expect(
      Math.abs(brokenHeight - healthyHeight),
      'the page reflowed when its art failed',
    ).toBeLessThan(2);

    /* Acceptance 4: the ruled ground, and nothing addressed to a developer. */
    const first = page.locator('[data-slot="image-fallback"]').first();

    await expect(first).toHaveCSS('background-color', STONE_250);
    await expect(first).toHaveText('');
    await expect(page.locator('[data-slot="placeholder"]')).toHaveCount(0);
  });

  /*
   * The plain-`<img>` path, and it has to be *earned*.
   *
   * The fixture vendor ships no photographs at all — `cover_image_url` and
   * every portfolio row are empty — so pointing this at a seeded surface would
   * have exercised the **absent** path and passed without the fix, which is
   * exactly the trap this ticket names. Verified by disabling the failure
   * branch and watching a profile-page version of this test stay green.
   *
   * So the photograph is uploaded here, through the product's own upload, and
   * *then* broken: a real object in the bucket, a real `<img>` on a real
   * bucket host, and a real 404 on reload. Nothing is stubbed but the response.
   */
  test('a portfolio photograph that stops resolving degrades to the tone block', async ({
    vendorPage,
  }) => {
    await vendorPage.goto('/vendor/portfolio');

    const tile = vendorPage
      .locator('img[src*="/uploads/"], img[src*="vendor-marketplace"]')
      .first();

    if ((await tile.count()) === 0) {
      await vendorPage.getByLabel('Add portfolio photos').setInputFiles(SAMPLE_PHOTOGRAPH);
    }

    /*
     * The photograph must genuinely load first, or the 404 below proves
     * nothing: a `naturalWidth` above zero is the browser saying it decoded a
     * real image off a real host.
     */
    await expect(tile).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(() => tile.evaluate((image: HTMLImageElement) => image.naturalWidth), {
        message: 'the uploaded photograph never resolved, so there is no load to break',
        timeout: 60_000,
      })
      .toBeGreaterThan(0);

    const healthyBox = await tile.boundingBox();
    const source = await tile.getAttribute('src');

    expect(source, 'the tile has no src to break').toBeTruthy();

    await breakEveryImage(vendorPage);
    await vendorPage.reload();
    await expect(vendorPage.getByRole('button', { name: 'Add photos' })).toBeVisible();

    /* Acceptance 1: the glyph is gone, on the path that had no handler at all. */
    await expect
      .poll(() => brokenImages(vendorPage), {
        message: 'a 404d bucket object was left in the DOM as a broken-image glyph',
      })
      .toEqual([]);

    const block = vendorPage.locator('[data-slot="image-fallback"]').first();

    await expect(block).toBeVisible();
    await expect(block).toHaveCSS('background-color', STONE_250);
    /* Acceptance 4: nothing inside it — no hatch, no label, no icon. */
    await expect(block).toHaveText('');

    /* Acceptance 3: the tile's own box, held to the pixel. */
    const brokenBox = await block.boundingBox();

    expect(brokenBox?.width).toBeCloseTo(healthyBox!.width, 0);
    expect(brokenBox?.height).toBeCloseTo(healthyBox!.height, 0);
  });
});
