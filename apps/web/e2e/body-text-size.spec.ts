import { expect, test } from './fixtures.js';

/**
 * VEN-389 — the rendered body size, read off a real document.
 *
 * `src/app/body-text-size.test.ts` pins the compiled cascade; only a browser
 * can answer what an element with no text utility actually inherits, and
 * whether `1rem` still means 16px for every spacing utility.
 */
test.describe('the document body type size', () => {
  test('body is 13.5px, an unsized div inherits it, and html stays 16px', async ({ page }) => {
    await page.goto('/');

    const sizes = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.textContent = 'probe';
      document.body.append(probe);

      const read = (element: Element) => getComputedStyle(element).fontSize;
      const result = {
        html: read(document.documentElement),
        body: read(document.body),
        div: read(probe),
      };
      probe.remove();

      return result;
    });

    expect(sizes).toEqual({ html: '16px', body: '13.5px', div: '13.5px' });
  });
});
