/**
 * #321. Fails if the handshake classifier stops recognising the loop — the
 * defect this guards against is exactly a check that reads the *symptom*
 * (a signed-out header) instead of the *hop count*, which is what made a
 * harness artifact look like a product defect (#259) for a day.
 *
 * Lives in `scripts/` and runs under plain `node` via `pnpm test:agents`, the
 * same position as `e2e-base-url.test.mjs`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countHandshakeHops, handshakeVerdict, isHandshakeHop } from './e2e-handshake.mjs';

// The shape actually measured on lane 313 restoring a stale `.auth/*.json`:
// the app's own request, three legs of the dev-instance handshake, then the
// destination settling. `countHandshakeHops` must read this as 3, matching
// the ticket's own measured table — not 0, and not "some hops".
const RESTORED_STALE_STATE_TRACE = [
  'http://localhost:3015/vendor/dashboard',
  'https://distinct-mongoose-1.clerk.accounts.dev/v1/client/handshake?redirect_url=http%3A%2F%2Flocalhost%3A3015%2Fvendor%2Fdashboard',
  'http://localhost:3015/vendor/dashboard?__clerk_handshake=eyJhbGciOiJSUzI1NiJ9...',
  'http://localhost:3015/vendor/dashboard?__clerk_synced=true',
  'http://localhost:3015/vendor/dashboard',
];

// The shape measured for a real in-context sign-in with no stored state: the
// token is minted at the moment of use, so there is nothing to refresh.
const REAL_SIGN_IN_TRACE = ['http://localhost:3015/vendor/dashboard'];

test('a restored, stale context enters the handshake loop — hop count matches the measured 3', () => {
  assert.equal(countHandshakeHops(RESTORED_STALE_STATE_TRACE), 3);
});

test('a real sign-in never enters the loop — zero hops', () => {
  assert.equal(countHandshakeHops(REAL_SIGN_IN_TRACE), 0);
});

test('a warm restored context (no handshake legs on this load) also reads zero', () => {
  assert.equal(countHandshakeHops(['http://localhost:3015/vendor/dashboard']), 0);
});

// The check this ticket requires: it must fail — flag the load as unsafe to
// assert against — the moment a restored context's first document request
// enters the handshake loop, rather than silently returning.
test('the verdict flags a non-zero hop count as unsafe to assert auth chrome against', () => {
  const verdict = handshakeVerdict(countHandshakeHops(RESTORED_STALE_STATE_TRACE));

  assert.equal(verdict.safe, false);
  assert.match(verdict.reason, /3 handshake hop/);
});

test('the verdict trusts a zero hop count', () => {
  const verdict = handshakeVerdict(countHandshakeHops(REAL_SIGN_IN_TRACE));

  assert.equal(verdict.safe, true);
});

test('recognises each handshake leg individually, and rejects the plain destination', () => {
  assert.equal(isHandshakeHop('https://x.clerk.accounts.dev/v1/client/handshake?a=b'), true);
  assert.equal(
    isHandshakeHop('http://localhost:3015/vendor/dashboard?__clerk_handshake=abc'),
    true,
  );
  assert.equal(isHandshakeHop('http://localhost:3015/vendor/dashboard?__clerk_synced=true'), true);
  assert.equal(isHandshakeHop('http://localhost:3015/vendor/dashboard'), false);
});
