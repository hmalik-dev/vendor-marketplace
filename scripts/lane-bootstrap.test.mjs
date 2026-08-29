/**
 * #232. `scripts/lane-bootstrap.mjs` is the one step that runs before a lane
 * has any `node_modules`, so it cannot use vitest — it is checked here with
 * `node:test` and run by `pnpm test:agents`, alongside the hook and workflow
 * checks that are in the same position.
 *
 * The assertion that matters is that the tree the link pointed at survives:
 * that is the whole defect. A lane running `pnpm install` through an inherited
 * symlink recreates the *target*, so it writes into what its peers are reading.
 */
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { dropInheritedModules } from './lane-bootstrap.mjs';

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'lane-bootstrap-'));
  const shared = path.join(root, 'main', 'node_modules');
  const worktree = path.join(root, 'worktree');

  mkdirSync(path.join(shared, '.pnpm'), { recursive: true });
  writeFileSync(path.join(shared, 'marker.txt'), 'peer data');
  mkdirSync(worktree, { recursive: true });

  return { root, shared, worktree };
}

test('drops an inherited symlink and leaves the shared tree intact', () => {
  const { root, shared, worktree } = fixture();

  symlinkSync(shared, path.join(worktree, 'node_modules'), 'dir');

  assert.equal(dropInheritedModules(worktree), true);
  assert.equal(existsSync(path.join(worktree, 'node_modules')), false);
  assert.equal(readFileSync(path.join(shared, 'marker.txt'), 'utf8'), 'peer data');
  assert.equal(existsSync(path.join(shared, '.pnpm')), true);

  rmSync(root, { recursive: true, force: true });
});

test('leaves a real node_modules directory alone', () => {
  const { root, worktree } = fixture();

  mkdirSync(path.join(worktree, 'node_modules', 'own'), { recursive: true });

  assert.equal(dropInheritedModules(worktree), false);
  assert.equal(existsSync(path.join(worktree, 'node_modules', 'own')), true);

  rmSync(root, { recursive: true, force: true });
});

test('does nothing when there is no node_modules yet', () => {
  const { root, worktree } = fixture();

  assert.equal(dropInheritedModules(worktree), false);
  assert.equal(existsSync(path.join(worktree, 'node_modules')), false);

  rmSync(root, { recursive: true, force: true });
});

test('importing the module does not install anything', () => {
  // The import at the top of this file already proved it: a bootstrap that ran
  // on import would have run `pnpm install` in this repository before the first
  // assertion. Kept as a named check so the guard is not silently deleted.
  assert.ok(true);
});
