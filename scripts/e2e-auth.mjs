// Creates reusable Playwright storage state for the E2E accounts.
//
// The problem this solves: an agent driving the browser needs to be signed in,
// but typing a password into a page means the password has to reach the agent,
// and every route for doing that is either blocked or leaves the secret in a
// transcript. Signing in ONCE and persisting the session removes the need
// entirely — afterwards the browser is already authenticated and no credential
// is ever handled again.
//
// Run:  pnpm e2e:auth            (every role the seed provisions)
//       pnpm e2e:auth customer   (one role)
//
// Output: .auth/<role>.json — gitignored. Load it with
//   browser.newContext({ storageState: '.auth/vendor.json' })
//
// The accounts are Neon Auth identities on the dev branch (VEN-447, VEN-448),
// created once with a verified address, so signing in needs no inbox and no
// code. The admin account is one of them; its `users.role` is granted by
// `db:seed:e2e`, never by signing in.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBaseUrl } from './e2e-base-url.mjs';
import { resolveRoles } from './e2e-roles.mjs';
import { describeFailure } from './e2e-diagnostics.mjs';
import {
  keepOffTheImageOptimizer,
  pruneSessions,
  signInRefusal,
  waitForSession,
  withRetry,
} from './e2e-sign-in.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = resolveBaseUrl();
const AUTH_DIR = resolve(ROOT, '.auth');
const DIAGNOSTICS_DIR = resolve(AUTH_DIR, 'diagnostics');

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
  await keepOffTheImageOptimizer(context);
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });

    /*
     * `domcontentloaded` is the server-rendered shell. A value filled before
     * React owns the field lands in the DOM but not in the form's state, so the
     * submit stays `disabled` and the click times out (VEN-570: the first role
     * on a cold `next start`). Wait for React's own stamp on the input.
     */
    await page.waitForFunction(
      () => {
        const input = document.querySelector('input[type="password"]');
        return !!input && Object.keys(input).some((key) => key.startsWith('__react'));
      },
      undefined,
      { timeout: 30000 },
    );

    await page.getByLabel(/email/i).first().fill(email);
    await page
      .getByLabel(/password/i)
      .first()
      .fill(password);
    /*
     * Done on the provider's answer and the cookie it sets, not when the page
     * leaves `/sign-in`: that is the role's home rendering, and a home that
     * never finishes is the journeys' failure to report, not this step's
     * (VEN-602). Registered before the click so the answer cannot be missed.
     */
    const answered = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/sign-in/email'),
      { timeout: 30000 },
    );
    // Awaited below; this only keeps a click that throws first from orphaning it.
    answered.catch(() => {});
    await page
      .getByRole('button', { name: /^(sign in|continue)$/i })
      .first()
      .click();

    const response = await answered;
    const refusal = signInRefusal(response.status(), await response.json().catch(() => null));
    if (refusal) throw refusal;
    await waitForSession(() => context.cookies());

    /* Where it went is only logged; a home still rendering is named, not waited on. */
    const landed = await page
      .waitForURL((url) => !url.pathname.startsWith('/sign-in'), {
        timeout: 5000,
        waitUntil: 'commit',
      })
      .then(() => new URL(page.url()).pathname)
      .catch(() => 'nowhere yet: the home had not rendered');

    mkdirSync(AUTH_DIR, { recursive: true });
    const out = resolve(AUTH_DIR, `${role}.json`);
    await context.storageState({ path: out });
    // Bounded, not zero: lanes share these accounts, so only the stalest of a pile-up go (VEN-714).
    const pruned = await pruneSessions(context.request, BASE);
    if (pruned > 0) {
      console.log(`  ${role}: ended ${pruned} stale session(s) over the cap`);
    }
    // A failed try before this one left its capture; the upload step must not read it as current.
    rmSync(resolve(DIAGNOSTICS_DIR, `${role}-sign-in-failure.png`), { force: true });
    console.log(`  ${role}: saved -> .auth/${role}.json  (landed on ${landed})`);
  } catch (error) {
    mkdirSync(DIAGNOSTICS_DIR, { recursive: true });
    error.diagnosis = await describeFailure(page, {
      role,
      secrets: [email, password],
      screenshotDir: DIAGNOSTICS_DIR,
    });
    throw error;
  } finally {
    await context.close();
  }
}

const env = readEnvFile('.env.e2e.local');
const argvRoles = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const { roles: wanted, explicit, refusal } = resolveRoles(argvRoles, BASE);

if (refusal) {
  console.error(refusal);
  process.exit(1);
}

const browser = await chromium.launch();
let failed = 0;
try {
  for (const role of wanted) {
    const email = env[`E2E_${role.toUpperCase()}_EMAIL`];
    const password = env[`E2E_${role.toUpperCase()}_PASSWORD`];
    if (!email || !password) {
      /*
       * A role nobody asked for individually is skipped, not failed. `admin` is
       * optional in `seed-e2e.ts` — a checkout whose `.env.e2e.local` predates
       * that key is a supported state — so failing the whole run for it would
       * turn a drifted env copy into a script that looks broken while customer
       * and vendor both signed in fine. Naming a role on argv is asking for it
       * by name, and that still fails.
       */
      const missing = `E2E_${role.toUpperCase()}_EMAIL/PASSWORD missing from .env.e2e.local`;
      if (explicit) {
        console.error(`  ${role}: ${missing}`);
        failed++;
      } else {
        console.log(`  ${role}: skipped — ${missing}`);
      }
      continue;
    }
    try {
      // Each attempt opens its own context, so a retry starts signed out.
      await withRetry(() => signIn(browser, role, email, password), {
        onRetry: (error, n) =>
          console.log(`  ${role}: attempt ${n} failed — ${error.message.split('\n')[0]}; retrying`),
      });
    } catch (error) {
      // Never echo the credential, only the failure.
      console.error(`  ${role}: FAILED — ${error.message.split('\n')[0]}`);
      for (const line of error.diagnosis ?? []) console.error(line);
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
