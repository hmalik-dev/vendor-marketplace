// Runs under `pnpm test:agents` (plain node, no framework).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'board.mjs');
const dir = mkdtempSync(path.join(tmpdir(), 'board-'));
const board = path.join(dir, 'tickets.md');
const archive = path.join(dir, 'archive.md');
const registry = path.join(dir, 'tickets.ts');

writeFileSync(
  board,
  `# Tracker

## Status Board

| # | Ticket | Phase | Milestone | Priority | Status | Branch | Blocked By | Capabilities | Notes |
|---|--------|-------|-----------|----------|--------|--------|------------|--------------|-------|
| **10** | **Needs a human** | INFRA | M-OPS | **P0 Critical** | **Deferred — needs a human** | — | **The account holder** | all | **Filed.** |
| **11** | **Blocked one** | P1 | M4 | **P0 Critical** | **Backlog** | — | **#10** | \`core\` \`stripe\` | **Waits on #10.** |
| **12** | **Ready low** | P3 | M6 | **P2 Medium** | **Backlog** | — | **None** | \`core\` | **Plain row.** |
| **13** | **Ready high, wrapped notes** | P3 | M6 | **P1 High** | **Backlog** | — | **None** — #5 landed | \`core\` \`auth\` | **Filed 2026-09-08.** First line
second line of the same cell. |
| **14** | **Already running** | P3 | M6 | **P1 High** | **In Progress** | \`worktree-14\` | **None** | \`core\` | **Started.** |

## Build Order

text

## Ticket Details

### #13: Ready high, wrapped notes

**Status:** Backlog

Body of 13.

### #14: Already running

**Status:** In Progress

Body of 14.

## Post-MVP Backlog

nothing
`,
);
writeFileSync(
  archive,
  `| **9** | **Old** | P1 | M1 | **P1 High** | **Done** | \`worktree-9\` | **None** | \`core\` | **Done.** |\n| **20** | **Older but higher id** | P1 | M1 | **P1 High** | **Done** | — | **None** | \`core\` | x |\n`,
);
writeFileSync(
  registry,
  `export const TICKET_CAPABILITIES = {\n  13: ['auth'], // ready high\n  14: [], // already running\n} as const;\n`,
);

const lanes = path.join(dir, 'lanes');
mkdirSync(lanes);
writeFileSync(path.join(lanes, '12.json'), JSON.stringify({ ticket: '12', state: 'active' }));
const env = {
  ...process.env,
  BOARD_FILE: board,
  ARCHIVE_FILE: archive,
  REGISTRY_FILE: registry,
  LANES_DIR: lanes,
};
const run = (...args) => {
  const r = spawnSync('node', [CLI, ...args], { env, encoding: 'utf8' });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
};

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(` ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}\n      ${e.message}`);
  }
}

check('depth counts open, ready, blocked and needs-human rows', () => {
  const d = JSON.parse(run('depth', '--json').out);
  assert.deepEqual(d, { open: 5, ready: 2, inProgress: 1, inLane: 1, blocked: 1, needsHuman: 1 });
});
check(
  'list --ready orders by priority, then In Progress, then id, and excludes blocked and deferred',
  () => {
    const ids = JSON.parse(run('list', '--ready', '--json').out).map((r) => r.id);
    assert.deepEqual(ids, ['14', '13']);
  },
);
check('next returns the highest-priority eligible ticket', () => {
  const r = JSON.parse(run('next', '--json').out);
  assert.equal(r.id, '14');
});
check('a ticket with an active lane manifest is not eligible; a failed lane is', () => {
  assert.equal(JSON.parse(run('get', '12', '--json').out).inLane, true);
  writeFileSync(path.join(lanes, '12.json'), JSON.stringify({ ticket: '12', state: 'failed' }));
  assert.equal(JSON.parse(run('get', '12', '--json').out).eligible, true);
  writeFileSync(path.join(lanes, '12.json'), JSON.stringify({ ticket: '12', state: 'active' }));
});
check('get returns the row and its detail section, including a wrapped notes cell', () => {
  const r = JSON.parse(run('get', '13', '--json').out);
  assert.equal(r.status, 'Backlog');
  assert.match(r.notes, /second line of the same cell/);
  assert.match(r.detail, /Body of 13/);
  assert.deepEqual(r.capabilities, ['core', 'auth']);
});
check('get on a missing row exits 2', () => {
  assert.equal(run('get', '99').code, 2);
});
check('set rewrites status, branch, notes and the detail Status line; other rows untouched', () => {
  const r = run(
    'set',
    '13',
    'Done',
    '--branch',
    'worktree-13',
    '--sha',
    'abcdef1234567',
    '--pr',
    '77',
  );
  assert.equal(r.code, 0, r.err);
  const text = readFileSync(board, 'utf8');
  assert.match(text, /\| \*\*13\*\* \|[^\n]*\| \*\*Done\*\* \| `worktree-13` \|/);
  assert.match(text, /second line of the same cell\. Landed `abcdef12` \(PR #77\) \|/);
  assert.match(text, /### #13: Ready high, wrapped notes\n\n\*\*Status:\*\* Done/);
  assert.match(text, /### #14: Already running\n\n\*\*Status:\*\* In Progress/);
  assert.match(text, /\| \*\*12\*\* \|[^\n]*\| \*\*Backlog\*\* \| — \|/);
  assert.equal(JSON.parse(run('depth', '--json').out).ready, 1);
});
check('set rejects an unknown status', () => {
  assert.equal(run('set', '12', 'Finished').code, 64);
});
check(
  'add appends a row after the last one, a detail section, and a registry entry with the next id across both files',
  () => {
    writeFileSync(path.join(dir, 'body.md'), '## Outcome\n\nA thing.\n');
    const r = run(
      'add',
      'New ticket',
      '--priority',
      'P1 High',
      '--capabilities',
      'core auth stripe',
      '--blocked-by',
      '#12',
      '--body',
      path.join(dir, 'body.md'),
    );
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /#21 filed/);
    const text = readFileSync(board, 'utf8');
    const rows = text.split('\n').filter((l) => /^\| \*\*\d+\*\* \|/.test(l));
    assert.match(
      rows[rows.length - 1],
      /^\| \*\*21\*\* \| \*\*New ticket\*\* \| P3 \| M6 \| \*\*P1 High\*\* \| \*\*Backlog\*\* \| — \| \*\*#12\*\* \| `core` `auth` `stripe` \|/,
    );
    assert.match(
      text,
      /### #21: New ticket\n\n\*\*Status:\*\* Backlog\n\n## Outcome\n\nA thing\.\n\n## Post-MVP Backlog/,
    );
    assert.match(
      readFileSync(registry, 'utf8'),
      /  14: \[\], \/\/ already running\n  21: \['auth', 'stripe'\], \/\/ New ticket\n/,
    );
    const added = JSON.parse(run('get', '21', '--json').out);
    assert.deepEqual(added.blockedByOpen, ['12']);
    assert.equal(added.eligible, false);
  },
);

rmSync(dir, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILING` : '\nAll board cases pass.');
process.exit(failures ? 1 : 0);
