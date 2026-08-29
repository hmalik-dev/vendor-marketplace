// Creates reusable Playwright storage state for the E2E accounts.
//
// The problem this solves: an agent driving the browser needs to be signed in,
// but typing a password into a page means the password has to reach the agent,
// and every route for doing that is either blocked or leaves the secret in a
// transcript. Signing in ONCE and persisting the session removes the need
// entirely — afterwards the browser is already authenticated and no credential
// is ever handled again.
//
// Run:  pnpm e2e:auth            (both roles)
//       pnpm e2e:auth customer   (one role)
//
// Output: .auth/<role>.json — gitignored. Load it with
//   browser.newContext({ storageState: '.auth/vendor.json' })
//
// The accounts are Clerk `+clerk_test` addresses on a development instance, so
// no real email is sent and the verification code is always 424242. That is
// Clerk's documented test mode, not a workaround:
// https://clerk.com/docs/testing/test-emails-and-phones
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBaseUrl } from './e2e-base-url.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = resolveBaseUrl();
const CLERK_TEST_CODE = '424242';
const AUTH_DIR = resolve(ROOT, '.auth');

function readEnvFile(name) {
  const path = resolve(ROOT, name);
  if (!existsSync(path)) throw new Error(`${name} not found at ${path}`);
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return out;
}

async function signIn(browser, role, email, password) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });

    await page.getByLabel(/email/i).first().fill(email);
    await page
      .getByRole('button', { name: /continue|sign in/i })
      .first()
      .click();

    await page
      .getByLabel(/password/i)
      .first()
      .fill(password);
    await page
      .getByRole('button', { name: /continue|sign in/i })
      .first()
      .click();

    // Clerk challenges every new device: "You're signing in from a new device."
    // It lands on /sign-in/client-trust with a single OTP field. `+clerk_test`
    // addresses always take 424242, so this needs no inbox and no real device.
    const signedIn = (url) => !url.pathname.startsWith('/sign-in');
    await page
      .waitForURL((url) => signedIn(url) || url.pathname.includes('client-trust'), {
        timeout: 20000,
      })
      .catch(() => {});

    if (!signedIn(new URL(page.url()))) {
      const codeField = page.getByLabel(/verification code/i).first();
      await codeField.waitFor({ state: 'visible', timeout: 10000 });
      // Clerk's OTP is a segmented input: `fill()` does not register and
      // `inputValue()` reports nothing, so type it digit by digit. It submits
      // itself on the sixth digit — there is no button to press.
      await codeField.click();
      await codeField.pressSequentially(CLERK_TEST_CODE, { delay: 80 });
      await page.waitForURL(signedIn, { timeout: 20000 }).catch(async () => {
        // Fallback for a build where auto-submit is off.
        const submit = page.getByRole('button', { name: /^continue$/i }).first();
        if (await submit.isEnabled().catch(() => false)) await submit.click();
        await page.waitForURL(signedIn, { timeout: 15000 });
      });
    }

    const cookies = await context.cookies();
    if (!cookies.some((c) => c.name.startsWith('__session'))) {
      throw new Error('signed in but no Clerk __session cookie was set');
    }

    mkdirSync(AUTH_DIR, { recursive: true });
    const out = resolve(AUTH_DIR, `${role}.json`);
    await context.storageState({ path: out });
    console.log(
      `  ${role}: saved -> .auth/${role}.json  (landed on ${new URL(page.url()).pathname})`,
    );
  } finally {
    await context.close();
  }
}

const env = readEnvFile('.env.e2e.local');
const roles = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const wanted = roles.length ? roles : ['customer', 'vendor'];

const browser = await chromium.launch();
let failed = 0;
try {
  for (const role of wanted) {
    const email = env[`E2E_${role.toUpperCase()}_EMAIL`];
    const password = env[`E2E_${role.toUpperCase()}_PASSWORD`];
    if (!email || !password) {
      console.error(
        `  ${role}: E2E_${role.toUpperCase()}_EMAIL/PASSWORD missing from .env.e2e.local`,
      );
      failed++;
      continue;
    }
    try {
      await signIn(browser, role, email, password);
      // Clerk rate-limits verification-code requests, so give the next role a
      // moment rather than racing it into a cooldown.
      if (wanted.indexOf(role) < wanted.length - 1) {
        await new Promise((r) => setTimeout(r, 4000));
      }
    } catch (error) {
      // Never echo the credential, only the failure.
      console.error(`  ${role}: FAILED — ${error.message}`);
      failed++;
    }
  }
} finally {
  await browser.close();
}

if (failed) {
  console.error(`\n${failed} role(s) failed. The app must be running at ${BASE}.`);
  process.exit(1);
}
console.log('\nStorage state ready. Agents should use it instead of signing in:');
console.log("  browser.newContext({ storageState: '.auth/vendor.json' })");
