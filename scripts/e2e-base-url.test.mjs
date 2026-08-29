/**
 * #238. `pnpm e2e:auth` inside a lane used to sign in against the main
 * checkout's port-3000 server — a different origin backed by the *shared*
 * database — and write the resulting storage state into the lane's worktree.
 * Every later browser pass in that lane then loaded a session minted against
 * the wrong data.
 *
 * Lives in `scripts/` and so runs under plain `node` via `pnpm test:agents`,
 * not vitest — the same position as `lane-bootstrap.test.mjs`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { resolveBaseUrl } from './e2e-base-url.mjs';

test('defaults to port 3000 outside a lane', () => {
  assert.equal(resolveBaseUrl({}), 'http://localhost:3000');
});

test('prefers an explicit E2E_BASE_URL over the lane environment', () => {
  assert.equal(
    resolveBaseUrl({
      E2E_BASE_URL: 'https://web-gules-eta-41.vercel.app',
      WEB_URL: 'http://localhost:3031',
      WEB_PORT: '3031',
    }),
    'https://web-gules-eta-41.vercel.app',
  );
});

test("takes the lane's WEB_URL when no override is set", () => {
  assert.equal(
    resolveBaseUrl({ WEB_URL: 'http://localhost:3031', WEB_PORT: '3031' }),
    'http://localhost:3031',
  );
});

test('builds the origin from WEB_PORT when only the port is known', () => {
  assert.equal(resolveBaseUrl({ WEB_PORT: '3018' }), 'http://localhost:3018');
});

test('falls back to 3000 when WEB_PORT is not a usable port', () => {
  assert.equal(resolveBaseUrl({ WEB_PORT: 'not-a-port' }), 'http://localhost:3000');
});

test('drops a trailing slash so the sign-in path does not double up', () => {
  assert.equal(resolveBaseUrl({ E2E_BASE_URL: 'http://localhost:3031/' }), 'http://localhost:3031');
});

/*
 * `WEB_URL` doubles as the API's CORS allow-list, so the registry types it as a
 * comma-separated list. Handing the whole string to `page.goto` throws
 * `Invalid URL` and every role fails.
 */
test('takes the first origin when WEB_URL carries a CORS list', () => {
  assert.equal(
    resolveBaseUrl({ WEB_URL: 'http://localhost:3031, https://staging.example' }),
    'http://localhost:3031',
  );
});

test('the resolved origin is always parseable as a URL', () => {
  for (const env of [
    {},
    { WEB_PORT: '3031' },
    { WEB_URL: 'http://localhost:3031, https://staging.example' },
    { E2E_BASE_URL: 'https://web-gules-eta-41.vercel.app/' },
  ]) {
    assert.doesNotThrow(() => new URL(`${resolveBaseUrl(env)}/sign-in`));
  }
});

/*
 * The helper being right does not make the script use it. Reverting
 * `e2e-auth.mjs` to its own `E2E_BASE_URL ?? 'http://localhost:3000'` left the
 * whole suite green, so the wiring is asserted against the source text — the
 * script cannot be imported, because it launches a browser at module load.
 */
test('e2e-auth.mjs resolves its base URL through this helper', () => {
  const source = readFileSync(new URL('./e2e-auth.mjs', import.meta.url), 'utf8');

  assert.match(source, /import \{ resolveBaseUrl \} from '\.\/e2e-base-url\.mjs'/);
  assert.match(source, /const BASE = resolveBaseUrl\(\)/);
  assert.doesNotMatch(source, /localhost:3000/);
});
