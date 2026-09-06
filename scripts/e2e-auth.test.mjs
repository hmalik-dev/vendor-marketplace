/**
 * `e2e-roles.mjs` — which roles `pnpm e2e:auth` mints, and against what.
 *
 * Two defects are pinned here, both from #392.
 *
 * The list read `['customer', 'vendor']`, predating the persistent admin
 * account (D27), so a no-argument run refreshed two of three sessions and every
 * lane inherited the main checkout's expired `.auth/admin.json`. The symptom is
 * nothing like the cause: `/admin` enters Clerk's handshake loop and reads as
 * the console being broken.
 *
 * Adding `admin` then made the *default* able to reach production, which is a
 * repo law. `resolveBaseUrl` puts `E2E_BASE_URL` at the top of its chain so a
 * run can be aimed at a deployed origin, and `docs/pre-launch.md` records that
 * production still authenticates against the same Clerk development instance —
 * so the E2E passwords work there, and admin carries authority over the real
 * console. Off localhost the roles must therefore be named by a human.
 *
 * `e2e-roles.mjs` is imported rather than read as text, which is the whole
 * reason it is a separate module: `e2e-auth.mjs` launches a browser and signs
 * in at module scope.
 *
 * Runs under plain `node` via `pnpm test:agents`, beside `e2e-base-url.test.mjs`
 * and `e2e-handshake.test.mjs`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { DEFAULT_ROLES, isLocalOrigin, resolveRoles } from './e2e-roles.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const seed = readFileSync(resolve(HERE, '../packages/db/src/scripts/seed-e2e.ts'), 'utf8');

/** Every role the seed reads an `E2E_<ROLE>_EMAIL` for. */
function seededRoles() {
  return [...new Set([...seed.matchAll(/E2E_([A-Z]+)_EMAIL/g)].map((m) => m[1].toLowerCase()))];
}

test('the default list covers every role the E2E seed provisions an account for', () => {
  const seeded = seededRoles();
  // Guards the regex itself: an expression that matched nothing would make the
  // comparison below trivially true against an empty list.
  assert.ok(seeded.includes('admin'), 'seed-e2e.ts must still read E2E_ADMIN_EMAIL');
  assert.equal(seeded.length, 3);

  assert.deepEqual(new Set(DEFAULT_ROLES), new Set(seeded));
});

test('a loopback origin gets the default list', () => {
  for (const base of ['http://localhost:3000', 'http://localhost:3015', 'http://127.0.0.1:3004']) {
    const { roles, refusal } = resolveRoles([], base);
    assert.equal(refusal, undefined, base);
    assert.deepEqual(roles, DEFAULT_ROLES, base);
  }
});

test('a deployed origin gets no default at all — it must be told', () => {
  const { roles, refusal } = resolveRoles([], 'https://web-gules-eta-41.vercel.app');

  assert.deepEqual(roles, []);
  assert.match(refusal, /Refusing to pick roles/);
  // The refusal has to say what to type instead, or it is just an obstacle.
  assert.match(refusal, /pnpm e2e:auth customer vendor/);
});

test('naming roles explicitly still works against any origin, and is marked explicit', () => {
  const { roles, explicit, refusal } = resolveRoles(
    ['customer'],
    'https://web-gules-eta-41.vercel.app',
  );

  assert.equal(refusal, undefined);
  assert.equal(explicit, true);
  assert.deepEqual(roles, ['customer']);
});

test('“localhost” appearing in a hostname is not a loopback origin', () => {
  /*
   * A substring test would pass all four of these. That exact bypass is already
   * recorded against the Clerk webhook guard, which is why `isLocalOrigin`
   * parses the URL and compares the hostname whole.
   */
  for (const base of [
    'https://localhost.example.com',
    'https://evil.com/?next=http://localhost:3000',
    'https://notlocalhost',
    'https://127.0.0.1.example.com',
  ]) {
    assert.equal(isLocalOrigin(base), false, base);
  }

  assert.equal(isLocalOrigin('http://localhost:3000'), true);
  assert.equal(isLocalOrigin('http://[::1]:3000'), true);
  // Garbage in is not loopback, rather than a thrown error nobody catches.
  assert.equal(isLocalOrigin('not a url'), false);
});

test('e2e-roles.mjs stays free of side effects, so importing it is safe', () => {
  const source = readFileSync(resolve(HERE, 'e2e-roles.mjs'), 'utf8');

  // The three things that would make an import drive a browser or exit.
  assert.equal(source.includes('playwright'), false);
  assert.equal(source.includes('process.exit'), false);
  assert.match(source, /^export (const|function)/m);
});
