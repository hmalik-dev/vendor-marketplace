/**
 * VEN-686. Every workflow job that holds NEON_API_KEY, the E2E Stripe key or
 * the E2E account passwords runs third-party actions, and a movable tag lets
 * whoever controls it run code beside those secrets. Every `uses:` must name a
 * 40-hex commit SHA; local `./` actions are exempt. Runs under plain `node`
 * via `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

const USES = /^\s*(?:-\s+)?uses:\s*(\S+)/;
const PINNED = /^[^@\s]+@[0-9a-f]{40}$/;
// A `uses` key written in a form USES cannot read (inline map, quoted key, value
// on the next line) is refused rather than skipped, so the guard fails closed.
const USES_KEY = /\buses["']?\s*:/;

/** Returns the `uses:` references that are neither local nor SHA-pinned. */
export const unpinnedActions = (source) =>
  source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .map((line) => USES.exec(line)?.[1] ?? (USES_KEY.test(line) ? line.trim() : undefined))
    .filter((ref) => ref !== undefined && !ref.startsWith('./') && !PINNED.test(ref));

test('a tag pin, a branch pin and a bare reference are all refused', () => {
  const sha = 'a'.repeat(40);
  assert.deepEqual(unpinnedActions('      - uses: actions/checkout@v4\n'), ['actions/checkout@v4']);
  assert.deepEqual(unpinnedActions('        uses: actions/cache@main # v4\n'), [
    'actions/cache@main',
  ]);
  assert.deepEqual(unpinnedActions('      - uses: actions/cache\n'), ['actions/cache']);
  assert.deepEqual(unpinnedActions(`      - uses: actions/checkout@${'a'.repeat(39)}\n`), [
    `actions/checkout@${'a'.repeat(39)}`,
  ]);
  assert.deepEqual(unpinnedActions(`      - uses: actions/checkout@${sha} # v4\n`), []);
  assert.deepEqual(unpinnedActions('      - uses: ./.github/actions/local\n'), []);
});

test('a uses key written in an unusual YAML form is refused, not skipped', () => {
  for (const line of [
    '      - { uses: actions/checkout@v4 }',
    '      - "uses": actions/checkout@v4',
    '      - uses:',
  ]) {
    assert.deepEqual(unpinnedActions(`${line}\n`), [line.trim()]);
  }
  assert.deepEqual(unpinnedActions('      # uses: actions/checkout@v4\n'), []);
});

test('every action in every workflow is pinned to a commit SHA', () => {
  const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(files.length >= 3, `expected the workflows to be found, got ${files.length}`);
  for (const file of files) {
    const source = readFileSync(path.join(WORKFLOWS, file), 'utf8');
    assert.deepEqual(unpinnedActions(source), [], `${file} has actions not pinned to a commit SHA`);
  }
});
