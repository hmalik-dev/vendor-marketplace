/**
 * What a failed `pnpm e2e:auth` role prints and leaves behind (VEN-570).
 *
 * The first CI run of the sign-in step failed with a bare Playwright timeout
 * that named neither the page nor the state of the form, so the cause had to be
 * guessed. This says where the browser was, what the page said, and whether the
 * form's fields and submit were in the state a sign-in needs — never a value.
 *
 * It is a separate module because `e2e-auth.mjs` launches a browser at module
 * scope, so a test cannot import it. The page is passed in, which is also what
 * lets the test drive it with a fake.
 *
 * Nothing here echoes an input's value. The public CI repository makes every
 * artifact world-readable, so the screenshot masks the form's inputs and no
 * trace is taken (a trace records the session cookies).
 */

const MAX_TEXT = 300;

/** Replace every secret's occurrences, and collapse whitespace so the line is one line. */
export function redact(text, secrets) {
  let out = text.replace(/\s+/g, ' ').trim();
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('[redacted]');
  }
  return out.length > MAX_TEXT ? `${out.slice(0, MAX_TEXT)}…` : out;
}

/** The URL without its query or fragment: a return path can carry an address. */
export function safeUrl(raw, secrets) {
  try {
    const url = new URL(raw);
    return redact(`${url.origin}${url.pathname}`, secrets);
  } catch {
    return '(no page url)';
  }
}

/**
 * Collect the diagnosis for one failed role, and save a screenshot when a
 * directory is given. Never throws: a diagnostic must not hide the failure it
 * describes.
 *
 * @param {import('playwright').Page} page
 * @param {{ role: string, secrets: string[], screenshotDir?: string }} options
 * @returns {Promise<string[]>} lines to print, already redacted
 */
export async function describeFailure(page, { role, secrets, screenshotDir }) {
  const lines = [];
  const attempt = async (label, run) => {
    try {
      lines.push(await run());
    } catch (error) {
      lines.push(`${label}: unavailable (${redact(String(error.message), secrets)})`);
    }
  };

  await attempt('url', async () => `    at:      ${safeUrl(page.url(), secrets)}`);
  await attempt('headings', async () => {
    const headings = await page.locator('h1, h2, [role="alert"]').allInnerTexts();
    return `    text:    ${redact(headings.join(' | ') || '(no heading or alert)', secrets)}`;
  });
  await attempt('form', async () => {
    const filled = async (selector) =>
      (await page.locator(selector).first().inputValue({ timeout: 1000 })) !== '';
    const submit = page.getByRole('button', { name: /^(sign in|continue)$/i }).first();
    const state = [
      `email ${(await filled('input[type="email"]')) ? 'filled' : 'empty'}`,
      `password ${(await filled('input[type="password"]')) ? 'filled' : 'empty'}`,
      `submit ${(await submit.isDisabled({ timeout: 1000 })) ? 'disabled' : 'enabled'}`,
    ];
    return `    form:    ${state.join(', ')}`;
  });

  if (screenshotDir) {
    await attempt('screenshot', async () => {
      const path = `${screenshotDir}/${role}-sign-in-failure.png`;
      await page.screenshot({ path, mask: [page.locator('input')] });
      return `    capture: ${path}`;
    });
  }

  return lines;
}
