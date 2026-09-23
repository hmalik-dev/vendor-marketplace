/**
 * `e2e-sign-in.mjs` — when `pnpm e2e:auth` counts a sign-in as done (VEN-602).
 *
 * The defect: the step waited for the page to leave `/sign-in`, which is the
 * post-sign-in render of the role's home. The customer's home is `/`, and on a
 * CI run where `/` never finished rendering the customer failed after 30s
 * although the session existed. The tests below drive a fake cookie jar, so
 * they pin the decision without a browser; the navigation can hang forever and
 * the wait still resolves on the cookie.
 *
 * Runs under plain `node` via `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  hasSessionCookie,
  keepOffTheImageOptimizer,
  signInRefusal,
  waitForSession,
  withRetry,
} from './e2e-sign-in.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A clock that only moves when the code under test sleeps. */
function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms) => void (t += ms), elapsed: () => t };
}

const SESSION = { name: 'neon-auth.session_token', value: 'abc' };

test('only a non-empty Neon Auth session token counts as signed in', () => {
  assert.equal(hasSessionCookie([SESSION]), true);
  assert.equal(
    hasSessionCookie([{ name: '__Secure-neon-auth.session_token', value: 'abc' }]),
    true,
  );
  // The SDK's cache cookie is set beside the token and is not a session.
  assert.equal(hasSessionCookie([{ name: 'neon-auth.session_data', value: 'abc' }]), false);
  assert.equal(hasSessionCookie([{ name: 'neon-auth.session_token', value: '' }]), false);
  assert.equal(hasSessionCookie([{ name: 'x-neon-auth.session_token', value: 'abc' }]), false);
  assert.equal(hasSessionCookie([]), false);
});

test('the wait resolves as soon as the cookie lands, whatever the page is doing', async () => {
  const clock = fakeClock();
  let reads = 0;
  // Empty for three polls, then the sign-in response's Set-Cookie arrives.
  const readCookies = async () => (++reads > 3 ? [SESSION] : []);

  await waitForSession(readCookies, { timeoutMs: 30_000, intervalMs: 250, ...clock });

  assert.equal(reads, 4);
  assert.equal(clock.elapsed(), 750);
});

test('the wait fails by name once the timeout passes with no session', async () => {
  const clock = fakeClock();

  await assert.rejects(
    waitForSession(async () => [{ name: 'neon-auth.session_data', value: 'abc' }], {
      timeoutMs: 1_000,
      intervalMs: 250,
      ...clock,
    }),
    /no Neon Auth session cookie was set within 1000ms of the sign-in/,
  );
  assert.equal(clock.elapsed(), 1_000);
});

test('a verified 200 is a session; the dev branch’s unverified 200 is not', () => {
  assert.equal(signInRefusal(200, { user: { emailVerified: true } }), null);
  assert.equal(signInRefusal(200, { user: {} }), null);
  assert.equal(signInRefusal(200, null), null);

  const unverified = signInRefusal(200, { user: { emailVerified: false } });
  assert.match(unverified.message, /address is unverified/);
  assert.equal(unverified.final, true);
});

test('a throttle or an unreachable provider is retryable', () => {
  for (const [status, body] of [
    [429, null],
    [403, { code: 'TOO_MANY_ATTEMPTS' }],
    [502, null],
    [503, {}],
  ]) {
    const refusal = signInRefusal(status, body);
    assert.ok(refusal instanceof Error, `${status} must refuse`);
    assert.equal(refusal.final, undefined, `${status} must be retryable`);
  }
  assert.match(signInRefusal(429, null).message, /throttled \(429\)/);
});

test('a wrong password or an unverified 403 is final: retrying cannot change it', () => {
  const wrong = signInRefusal(401, { code: 'INVALID_EMAIL_OR_PASSWORD' });
  assert.equal(wrong.final, true);
  assert.match(wrong.message, /refused \(401\): check the password/);

  const unverified = signInRefusal(403, { code: 'EMAIL_NOT_VERIFIED' });
  assert.equal(unverified.final, true);
  assert.match(unverified.message, /unverified/);
});

test('a failed attempt is retried after the backoff, and a success returns', async () => {
  const clock = fakeClock();
  const retried = [];
  const seen = [];

  const result = await withRetry(
    async (n) => {
      seen.push(n);
      if (n === 1) throw new Error('first try timed out');
      return 'signed in';
    },
    {
      attempts: 2,
      backoffMs: 5_000,
      sleep: clock.sleep,
      onRetry: (e, n) => retried.push([e.message, n]),
    },
  );

  assert.equal(result, 'signed in');
  assert.deepEqual(seen, [1, 2]);
  assert.deepEqual(retried, [['first try timed out', 1]]);
  assert.equal(clock.elapsed(), 5_000);
});

test('a final error is thrown at once, with no retry and no backoff', async () => {
  const clock = fakeClock();
  let calls = 0;

  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        throw signInRefusal(401, null);
      },
      { attempts: 3, backoffMs: 15_000, sleep: clock.sleep },
    ),
    /refused \(401\)/,
  );
  assert.equal(calls, 1);
  assert.equal(clock.elapsed(), 0);
});

test('the last error is thrown once the attempts run out, with no trailing backoff', async () => {
  const clock = fakeClock();
  let calls = 0;

  await assert.rejects(
    withRetry(
      async (n) => {
        calls++;
        throw new Error(`attempt ${n} failed`);
      },
      { attempts: 2, backoffMs: 5_000, sleep: clock.sleep },
    ),
    /attempt 2 failed/,
  );
  assert.equal(calls, 2);
  assert.equal(clock.elapsed(), 5_000);
});

test('e2e-auth.mjs finishes on the session, not on the post-sign-in navigation', () => {
  const script = readFileSync(resolve(HERE, 'e2e-auth.mjs'), 'utf8')
    // Comments may name the old wait; only code counts.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  assert.match(script, /await waitForSession\(\s*\(\) => context\.cookies\(\)/);
  assert.match(script, /withRetry\(/);
  // The provider's answer is judged before the cookie counts (the unverified 200).
  assert.match(script, /if \(refusal\) throw refusal/);
  assert.ok(
    script.indexOf('signInRefusal(') < script.indexOf('await waitForSession('),
    'the answer must be judged before the cookie wait',
  );
  // A fatal waitForURL is the defect: any left must be caught.
  for (const statement of script.split(';').filter((s) => s.includes('waitForURL('))) {
    assert.match(statement, /\.catch\(/, `an uncaught waitForURL is back: ${statement.trim()}`);
  }
});

test('the sign-in browser answers every optimizer request itself (VEN-655)', async () => {
  const routes = [];
  await keepOffTheImageOptimizer({
    route: async (pattern, handler) => routes.push({ pattern, handler }),
  });

  assert.equal(routes.length, 1);
  const [{ pattern }] = routes;
  assert.equal(
    pattern.test('http://localhost:3000/_next/image?url=%2Fstock%2Fflorals.jpg&w=256&q=75'),
    true,
  );
  assert.equal(pattern.test('http://localhost:3000/categories/decor.jpg'), false);
  assert.equal(pattern.test('http://localhost:3000/_next/static/chunks/main.js'), false);
  let aborted = 0;
  await routes[0].handler({ abort: async () => void (aborted += 1) });
  assert.equal(aborted, 1);
});
