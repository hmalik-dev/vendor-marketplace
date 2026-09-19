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
// code. The operator account is one of them; its `users.role` is granted by
// `db:seed:e2e`, never by signing in.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBaseUrl } from './e2e-base-url.mjs';
import { resolveRoles } from './e2e-roles.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = resolveBaseUrl();
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
      .getByLabel(/password/i)
      .first()
      .fill(password);
    await page
      .getByRole('button', { name: /^(sign in|continue)$/i })
      .first()
      .click();

    await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30000 });

    const cookies = await context.cookies();
    if (!cookies.some((c) => c.name.includes('neon-auth'))) {
      throw new Error('signed in but no Neon Auth session cookie was set');
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
      await signIn(browser, role, email, password);
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
