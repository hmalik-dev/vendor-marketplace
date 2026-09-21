/**
 * `e2e-diagnostics.mjs` — the failure report for a role that could not sign in
 * (VEN-570). The page is a fake, so the test can plant a sentinel where a real
 * page might leak one and assert by value that it never reaches the output.
 *
 * Runs under plain `node` via `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeFailure, redact, safeUrl } from './e2e-diagnostics.mjs';

// Built, not written out, so a secret scanner has nothing to mistake for a credential.
const SENTINEL_A = ['sentinel', 'a', '91f3'].join('-');
const SENTINEL_B = ['sentinel', 'b', '77c2'].join('.') + '@example.test';

function fakePage({ url, texts, emailValue = '', secretValue = '', disabled = false, shots = [] }) {
  return {
    url: () => url,
    locator: (selector) => ({
      allInnerTexts: async () => texts,
      first: () => ({
        inputValue: async () => (selector.includes('email') ? emailValue : secretValue),
      }),
    }),
    getByRole: () => ({ first: () => ({ isDisabled: async () => disabled }) }),
    screenshot: async (options) => {
      shots.push(options);
    },
  };
}

test('prints where the page was, what it said and the form state', async () => {
  const lines = await describeFailure(
    fakePage({
      url: 'http://localhost:3000/sign-in?returnTo=%2Faccount',
      texts: ['Sign in', "That email and password didn't match."],
      disabled: true,
    }),
    { role: 'customer', secrets: [SENTINEL_A, SENTINEL_B] },
  );

  assert.deepEqual(lines, [
    '    at:      http://localhost:3000/sign-in',
    "    text:    Sign in | That email and password didn't match.",
    '    form:    email empty, password empty, submit disabled',
  ]);
});

test('never echoes a secret, even when the page or the URL carries one', async () => {
  const lines = await describeFailure(
    fakePage({
      url: `http://localhost:3000/sign-in?email=${SENTINEL_B}`,
      texts: [`Welcome back ${SENTINEL_B}`, `bad ${SENTINEL_A}`],
      emailValue: SENTINEL_B,
      secretValue: SENTINEL_A,
    }),
    { role: 'customer', secrets: [SENTINEL_A, SENTINEL_B] },
  );

  const output = lines.join('\n');
  assert.ok(!output.includes(SENTINEL_A), 'the first secret reached the output');
  assert.ok(!output.includes(SENTINEL_B), 'the address reached the output');
  assert.match(output, /email filled, password filled, submit enabled/);
  assert.match(output, /Welcome back \[redacted\] \| bad \[redacted\]/);
});

test('saves a screenshot with the inputs masked', async () => {
  const shots = [];
  const lines = await describeFailure(
    fakePage({ url: 'http://localhost:3000/sign-in', texts: [], shots }),
    { role: 'customer', secrets: [], screenshotDir: '.auth/diagnostics' },
  );

  assert.equal(shots.length, 1);
  assert.equal(shots[0].path, '.auth/diagnostics/customer-sign-in-failure.png');
  assert.equal(shots[0].mask.length, 1);
  assert.ok(lines.includes('    capture: .auth/diagnostics/customer-sign-in-failure.png'));
});

test('a page that throws still yields a report rather than hiding the failure', async () => {
  const page = fakePage({ url: 'http://localhost:3000/sign-in', texts: [] });
  page.locator = () => {
    throw new Error(`boom ${SENTINEL_A}`);
  };
  const lines = await describeFailure(page, { role: 'customer', secrets: [SENTINEL_A] });

  assert.equal(lines.length, 3);
  assert.ok(!lines.join('\n').includes(SENTINEL_A));
  assert.match(lines[1], /unavailable/);
});

test('redact bounds the text and safeUrl drops the query', () => {
  assert.equal(redact('x'.repeat(500), []).length, 301);
  assert.equal(safeUrl('http://localhost:3000/a?b=c#d', []), 'http://localhost:3000/a');
  assert.equal(safeUrl('not a url', []), '(no page url)');
});
