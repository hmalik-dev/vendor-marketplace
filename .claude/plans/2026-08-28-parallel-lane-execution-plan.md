# Parallel Lane Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run three to five ticket lanes concurrently in isolated worktrees, each carrying the full quality gate, landing through a merge queue that makes it structurally impossible to break `main`.

**Architecture:** A lane is one ticket owning a worktree, a git branch, a Neon child branch, and a probed port pair, recorded in a gitignored per-lane manifest in the main checkout. New `lane:up` / `lane:down` / `lane:exec` tooling in `packages/preflight` replaces a documented-but-never-executed port-offset rule. Lanes deliver by enqueuing a PR and exiting; a new `/land-lanes` sweep observes merges and cleans up.

**Tech Stack:** TypeScript ESM, Node 24, vitest, tsx, pnpm workspaces, Turborepo, `neonctl`, `gh`, GitHub merge queue.

**Spec:** `.claude/plans/2026-08-28-parallel-lane-execution-design.md`

## Global Constraints

- **`main` is never broken.** Every landing path goes through the merge queue, which re-tests each PR against `main` plus everything ahead of it. No task may introduce a direct push to `main`.
- **No lane mutates state another lane reads.** The one deliberate exception is `.claude/lanes/`, written one file per lane under `O_EXCL` or the allocation lock.
- **Isolation is executable**, never a paragraph asking a future session to remember. Per `~/.claude/CLAUDE.md`: prefer an executable guard over a written rule.
- **Credentials never reach a command line, a tracked file, or anything under `.claude/`.** Connection strings come back from `neonctl` at runtime and are written only to `.env.lane`, which `.gitignore` already covers via `.env.*`.
- **Every code change ships with tests in the same commit.** Exempt only: `.md` / `.json` / `.yaml` / whitespace / CSS-only-no-logic.
- **Conventional Commits.** Subject 10–72 chars, imperative, capitalized, no trailing period.
- Package is ESM (`"type": "module"`); relative imports carry the `.js` extension, matching `packages/preflight/src/checks/ports.ts`.
- Lane databases live on the local `vendor-marketplace-postgres` container. **Never Neon, and never production.**
- Port bases: web `3000`, api `4000`. Offset range `1..40`.

## Sequencing constraint: the peer session

A second interactive session (`vendor-marketplace-83`) currently holds uncommitted edits to `package.json`, `.github/workflows/ci.yml`, `CLAUDE.md`, `.claude/agents/parity-checker.md`, `.claude/rules/web-design-parity.md`, and `design/design-plan/*`.

Tasks 1–6 and 9–11 touch **none** of those files and may proceed immediately. **Tasks 7, 8, and 12 modify contested files and must wait** until that session's work is committed. A background watch on `HEAD` is already running and will report when it lands.

## File structure

**New — `packages/preflight/src/lane/`** (one responsibility per file, all consumed by `cli.ts`):

| File | Responsibility |
| --- | --- |
| `manifest.ts` | Lane manifest type, read/claim/update/remove, the `mkdir` allocation lock |
| `ports.ts` | Stable hash, deterministic first offset, probe-and-claim allocation |
| `neon.ts` | Lane Neon branch create/delete, connection-string retrieval |
| `env.ts` | Render and parse `.env.lane`; build a child environment |
| `cli.ts` | `up` / `down` / `exec` subcommands |
| `*.test.ts` | Colocated vitest suites, one per module |

Reuses, rather than reimplements, `src/exec.ts` (`runCommand`, `isInstalled`) and `parseHolders` from `src/checks/ports.ts`.

**Modified:** `package.json` (root), `apps/web/package.json`, `.gitignore`, `.claude/settings.json`, `.github/workflows/ci.yml`, `CLAUDE.md`.

**Global (`~/.claude`):** `skills/karpathy-guidelines/`, `skills/land-lanes/`, `skills/ticket/`, `skills/next-ticket/`, `skills/verify-and-ship/`, `skills/orchestrate/`, `skills/start/`, `orchestration-policy.md`.

---

### Task 1: Vendor the karpathy-guidelines skill

Touches no repository file. Safe to run alongside the peer session.

**Files:**
- Create: `~/.claude/skills/karpathy-guidelines/SKILL.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a skill invocable as `karpathy-guidelines`, referenced by Task 10's workflow edit.

- [ ] **Step 1: Copy the skill from the cloned reference repo**

```bash
mkdir -p ~/.claude/skills/karpathy-guidelines
cp /private/tmp/claude-501/-Users-humza-Documents-vendor-marketplace/9033cfb2-89fb-48c5-bff3-bd6b6be70a25/scratchpad/kskills/skills/karpathy-guidelines/SKILL.md \
   ~/.claude/skills/karpathy-guidelines/SKILL.md
```

If the scratchpad clone is gone, re-clone: `git clone --depth 1 https://github.com/multica-ai/andrej-karpathy-skills.git`.

- [ ] **Step 2: Add provenance to the frontmatter body**

Append immediately after the frontmatter block, before `# Karpathy Guidelines`:

```markdown
<!-- Vendored 2026-08-28 from multica-ai/andrej-karpathy-skills (MIT). Do not edit in place; re-vendor to update. -->
```

- [ ] **Step 3: Verify the skill is discoverable**

Run: `ls ~/.claude/skills/karpathy-guidelines/SKILL.md && head -5 ~/.claude/skills/karpathy-guidelines/SKILL.md`
Expected: the file exists and its frontmatter shows `name: karpathy-guidelines`.

- [ ] **Step 4: Commit (global config repo)**

```bash
cd ~/.claude
git add skills/karpathy-guidelines/SKILL.md
git commit -m "feat: Vendor the karpathy-guidelines skill"
```

---

### Task 2: Lane manifest and allocation lock

**Files:**
- Create: `packages/preflight/src/lane/manifest.ts`
- Test: `packages/preflight/src/lane/manifest.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface LaneManifest { ticket: string; branch: string; worktreePath: string; apiPort: number; webPort: number; neonBranch: string; prUrl: string | null; state: LaneState; createdAt: string }`
  - `type LaneState = 'active' | 'pending-merge' | 'failed'`
  - `lanesDir(mainCheckout: string): string`
  - `readManifests(mainCheckout: string): LaneManifest[]`
  - `readManifest(mainCheckout: string, ticket: string): LaneManifest | null`
  - `claimManifest(mainCheckout: string, manifest: LaneManifest): boolean`
  - `updateManifest(mainCheckout: string, ticket: string, patch: Partial<LaneManifest>): LaneManifest`
  - `removeManifest(mainCheckout: string, ticket: string): void`
  - `withLock<T>(mainCheckout: string, fn: () => Promise<T>): Promise<T>`

- [ ] **Step 1: Write the failing test**

```ts
// packages/preflight/src/lane/manifest.test.ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  claimManifest,
  readManifest,
  readManifests,
  removeManifest,
  updateManifest,
  withLock,
  type LaneManifest,
} from './manifest.js';

let root: string;

const sample = (ticket: string): LaneManifest => ({
  ticket,
  branch: `lane/${ticket}`,
  worktreePath: `/repo/.claude/worktrees/${ticket}`,
  apiPort: 4007,
  webPort: 3007,
  neonBranch: `lane/${ticket}`,
  prUrl: null,
  state: 'active',
  createdAt: '2026-08-28T00:00:00.000Z',
});

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'lanes-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('lane manifest', () => {
  it('round-trips every field', () => {
    claimManifest(root, sample('42'));
    expect(readManifest(root, '42')).toEqual(sample('42'));
  });

  it('refuses to claim a ticket that already has a manifest', () => {
    expect(claimManifest(root, sample('42'))).toBe(true);
    expect(claimManifest(root, { ...sample('42'), apiPort: 4099 })).toBe(false);
    expect(readManifest(root, '42')?.apiPort).toBe(4007);
  });

  it('returns null for a ticket with no manifest', () => {
    expect(readManifest(root, 'nope')).toBeNull();
  });

  it('lists every claimed lane', () => {
    claimManifest(root, sample('1'));
    claimManifest(root, sample('2'));
    expect(readManifests(root).map((m) => m.ticket).sort()).toEqual(['1', '2']);
  });

  it('patches a field without disturbing the rest', () => {
    claimManifest(root, sample('42'));
    const updated = updateManifest(root, '42', {
      prUrl: 'https://github.com/o/r/pull/9',
      state: 'pending-merge',
    });
    expect(updated.prUrl).toBe('https://github.com/o/r/pull/9');
    expect(updated.state).toBe('pending-merge');
    expect(updated.apiPort).toBe(4007);
  });

  it('removes a manifest and tolerates removing it twice', () => {
    claimManifest(root, sample('42'));
    removeManifest(root, '42');
    removeManifest(root, '42');
    expect(readManifest(root, '42')).toBeNull();
  });

  it('serialises concurrent lock holders', async () => {
    const order: string[] = [];
    await Promise.all([
      withLock(root, async () => {
        order.push('a-in');
        await new Promise((r) => setTimeout(r, 30));
        order.push('a-out');
      }),
      withLock(root, async () => {
        order.push('b-in');
        order.push('b-out');
      }),
    ]);
    // Whoever wins, neither pair interleaves.
    expect(order.join(',')).toMatch(/^(a-in,a-out,b-in,b-out|b-in,b-out,a-in,a-out)$/);
  });

  it('releases the lock when the body throws', async () => {
    await expect(
      withLock(root, () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    await expect(withLock(root, async () => 'ok')).resolves.toBe('ok');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/manifest`
Expected: FAIL — `Cannot find module './manifest.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/preflight/src/lane/manifest.ts
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync, writeSync } from 'node:fs';
import path from 'node:path';

export type LaneState = 'active' | 'pending-merge' | 'failed';

export interface LaneManifest {
  readonly ticket: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly apiPort: number;
  readonly webPort: number;
  readonly neonBranch: string;
  readonly prUrl: string | null;
  readonly state: LaneState;
  readonly createdAt: string;
}

/**
 * Lane manifests live in the MAIN checkout, never in a worktree: lanes must see
 * each other's claimed ports, and cleanup must still know what to delete after
 * the lane's session has exited.
 */
export function lanesDir(mainCheckout: string): string {
  return path.join(mainCheckout, '.claude', 'lanes');
}

function manifestPath(mainCheckout: string, ticket: string): string {
  return path.join(lanesDir(mainCheckout), `${ticket}.json`);
}

export function readManifest(mainCheckout: string, ticket: string): LaneManifest | null {
  const file = manifestPath(mainCheckout, ticket);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8')) as LaneManifest;
}

export function readManifests(mainCheckout: string): LaneManifest[] {
  const dir = lanesDir(mainCheckout);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(path.join(dir, name), 'utf8')) as LaneManifest);
}

/**
 * Creates the manifest with O_EXCL, so two lanes racing on the same ticket
 * cannot both believe they own it. Returns false when one already exists —
 * that is a resumed lane, not an error.
 */
export function claimManifest(mainCheckout: string, manifest: LaneManifest): boolean {
  mkdirSync(lanesDir(mainCheckout), { recursive: true });

  let fd: number;
  try {
    fd = openSync(manifestPath(mainCheckout, manifest.ticket), 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }

  try {
    writeSync(fd, `${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    closeSync(fd);
  }

  return true;
}

export function updateManifest(
  mainCheckout: string,
  ticket: string,
  patch: Partial<LaneManifest>,
): LaneManifest {
  const current = readManifest(mainCheckout, ticket);
  if (!current) throw new Error(`No lane manifest for ticket ${ticket}`);

  const next: LaneManifest = { ...current, ...patch };
  writeFileSync(manifestPath(mainCheckout, ticket), `${JSON.stringify(next, null, 2)}\n`);

  return next;
}

/** Idempotent: removing a lane that is already gone is a success, not an error. */
export function removeManifest(mainCheckout: string, ticket: string): void {
  rmSync(manifestPath(mainCheckout, ticket), { force: true });
}

const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 10_000;

/**
 * `mkdir` is atomic on POSIX, which makes it a correct mutex without a
 * dependency. Guards the read-then-write window in port allocation, where two
 * lanes would otherwise read the same set of claimed ports and pick the same
 * offset.
 */
export async function withLock<T>(mainCheckout: string, fn: () => Promise<T>): Promise<T> {
  const lock = path.join(lanesDir(mainCheckout), '.lock');
  mkdirSync(lanesDir(mainCheckout), { recursive: true });

  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for the lane allocation lock at ${lock}`);
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }

  try {
    return await fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/manifest`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/preflight/src/lane/manifest.ts packages/preflight/src/lane/manifest.test.ts
git commit -m "feat: Add lane manifest store and allocation lock"
```

---

### Task 3: Deterministic, collision-proof port allocation

**Files:**
- Create: `packages/preflight/src/lane/ports.ts`
- Test: `packages/preflight/src/lane/ports.test.ts`

**Interfaces:**
- Consumes: `parseHolders` from `../checks/ports.js`, `runCommand` from `../exec.js`, `LaneManifest` from `./manifest.js`.
- Produces:
  - `WEB_BASE = 3000`, `API_BASE = 4000`, `MAX_OFFSET = 40`
  - `stableHash(value: string): number`
  - `firstOffset(ticket: string): number`
  - `isPortFree(port: number): Promise<boolean>`
  - `type PortProbe = (port: number) => Promise<boolean>`
  - `allocateOffset(ticket: string, claimed: ReadonlySet<number>, probe?: PortProbe): Promise<number>`

- [ ] **Step 1: Write the failing test**

```ts
// packages/preflight/src/lane/ports.test.ts
import { describe, expect, it } from 'vitest';
import { allocateOffset, API_BASE, firstOffset, MAX_OFFSET, stableHash, WEB_BASE } from './ports.js';

const allFree = async () => true;

describe('stableHash', () => {
  it('is deterministic across calls', () => {
    expect(stableHash('42')).toBe(stableHash('42'));
  });

  it('separates different tickets', () => {
    expect(stableHash('42')).not.toBe(stableHash('43'));
  });
});

describe('firstOffset', () => {
  it('always lands inside the usable range', () => {
    for (const ticket of ['1', '42', 'ORL-1234', 'a-very-long-ticket-identifier']) {
      const offset = firstOffset(ticket);
      expect(offset).toBeGreaterThanOrEqual(1);
      expect(offset).toBeLessThanOrEqual(MAX_OFFSET);
    }
  });
});

describe('allocateOffset', () => {
  it('returns the deterministic first guess when both ports are free', async () => {
    expect(await allocateOffset('42', new Set(), allFree)).toBe(firstOffset('42'));
  });

  it('skips an offset already claimed by another lane', async () => {
    const first = firstOffset('42');
    const offset = await allocateOffset('42', new Set([first]), allFree);
    expect(offset).not.toBe(first);
  });

  it('skips an offset whose web port has a live listener', async () => {
    const first = firstOffset('42');
    const probe = async (port: number) => port !== WEB_BASE + first;
    expect(await allocateOffset('42', new Set(), probe)).not.toBe(first);
  });

  it('skips an offset whose api port has a live listener', async () => {
    const first = firstOffset('42');
    const probe = async (port: number) => port !== API_BASE + first;
    expect(await allocateOffset('42', new Set(), probe)).not.toBe(first);
  });

  it('throws rather than silently reusing a port when the range is exhausted', async () => {
    const claimed = new Set(Array.from({ length: MAX_OFFSET }, (_, i) => i + 1));
    await expect(allocateOffset('42', claimed, allFree)).rejects.toThrow(/exhausted/i);
  });

  it('gives two different tickets two different offsets under contention', async () => {
    const a = await allocateOffset('42', new Set(), allFree);
    const b = await allocateOffset('43', new Set([a]), allFree);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/ports`
Expected: FAIL — `Cannot find module './ports.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/preflight/src/lane/ports.ts
import { parseHolders } from '../checks/ports.js';
import { runCommand } from '../exec.js';

export const WEB_BASE = 3000;
export const API_BASE = 4000;

/**
 * Both ports move together on one offset, so `NEXT_PUBLIC_API_URL` is always
 * derivable from the lane's own offset. Forty is far above the five-lane
 * ceiling; exhausting it means lanes are leaking, which should be loud.
 */
export const MAX_OFFSET = 40;

/** FNV-1a, 32-bit. Stable across processes and Node versions, unlike hashCode-style ad-hoc mixing. */
export function stableHash(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

/** The deterministic first guess, so a lane's ports are reproducible across restarts. */
export function firstOffset(ticket: string): number {
  return (stableHash(ticket) % MAX_OFFSET) + 1;
}

export type PortProbe = (port: number) => Promise<boolean>;

export async function isPortFree(port: number): Promise<boolean> {
  const outcome = await runCommand('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-F', 'cp']);

  // Without lsof the port cannot be inspected; treat it as free and let the
  // server itself fail loudly on EADDRINUSE rather than blocking the lane here.
  if (outcome.status === 'missing') return true;

  return parseHolders(outcome.stdout).length === 0;
}

/**
 * Deterministic first guess, then probe upward wrapping within the range.
 * Deterministic to be reproducible; probed to be collision-proof.
 */
export async function allocateOffset(
  ticket: string,
  claimed: ReadonlySet<number>,
  probe: PortProbe = isPortFree,
): Promise<number> {
  const start = firstOffset(ticket);

  for (let step = 0; step < MAX_OFFSET; step += 1) {
    const offset = ((start - 1 + step) % MAX_OFFSET) + 1;
    if (claimed.has(offset)) continue;
    if ((await probe(WEB_BASE + offset)) && (await probe(API_BASE + offset))) {
      return offset;
    }
  }

  throw new Error(
    `All ${MAX_OFFSET} lane offsets are exhausted for ticket ${ticket}. ` +
      `Run /land-lanes — stale lanes are leaking manifests or dev servers.`,
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/ports`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/preflight/src/lane/ports.ts packages/preflight/src/lane/ports.test.ts
git commit -m "feat: Allocate collision-proof lane port pairs"
```

---

### Task 4: Lane database lifecycle

> **Amended 2026-08-29.** This task originally created a Neon branch per lane.
> Main's `5ca9a5f` moved local development off Neon — an always-open `pnpm dev`
> pool stops a Neon compute scaling to zero, pacing ~375h/month against a 100
> CU-hour cap whose exhaustion suspends the compute shared with production, and
> lanes multiply that. It now creates a database per lane on the one local
> Docker container: `packages/preflight/src/lane/database.ts`. `NEON_BRANCH` and
> `DATABASE_URL_UNPOOLED` are no longer written into the lane env, because the
> registry marks both absent-by-design for `local`.
>
> The section below is kept for the reasoning it records; read `database.ts` and
> `database.test.ts` for what shipped.

#### Original: Neon branch lifecycle

Copy-on-write child branches off `dev`, so lanes never write the shared dev database.

**Credential discipline:** connection strings come back from `neonctl` on stdout and reach `.env.lane` in memory. **Never echo one, never log one, never put one on a command line.** Note that the test fixtures below deliberately carry no userinfo component — a fixture shaped like a real credential trips the repository's secret scanner and the `PreToolUse` guard, and teaches the wrong habit.

**Files:**
- Create: `packages/preflight/src/lane/neon.ts`
- Test: `packages/preflight/src/lane/neon.test.ts`

**Interfaces:**
- Consumes: `runCommand`, `type CommandOutcome` from `../exec.js`.
- Produces:
  - `PARENT_BRANCH = 'dev'`
  - `laneBranchName(ticket: string): string`
  - `interface LaneDatabase { readonly pooled: string; readonly unpooled: string }`
  - `type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandOutcome>`
  - `createLaneBranch(ticket: string, run?: CommandRunner): Promise<LaneDatabase>`
  - `deleteLaneBranch(ticket: string, run?: CommandRunner): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// packages/preflight/src/lane/neon.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { CommandOutcome } from '../exec.js';
import { createLaneBranch, deleteLaneBranch, laneBranchName, PARENT_BRANCH } from './neon.js';

const ok = (stdout: string): CommandOutcome => ({ status: 'ok', stdout, stderr: '' });
const failed = (stderr: string): CommandOutcome => ({ status: 'failed', stdout: '', stderr });
const missing = (): CommandOutcome => ({ status: 'missing', stdout: '', stderr: '' });

// No userinfo component: fixtures must never be credential-shaped.
const POOLED = 'postgresql://pooled.lane.invalid/db?sslmode=require';
const DIRECT = 'postgresql://direct.lane.invalid/db?sslmode=require';
const CREATED = '{"branch":{"id":"br-test"}}';

describe('laneBranchName', () => {
  it('namespaces the branch under lane/', () => {
    expect(laneBranchName('42')).toBe('lane/42');
  });
});

describe('createLaneBranch', () => {
  it('branches off dev and returns both connection strings', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce(ok(CREATED))
      .mockResolvedValueOnce(ok(POOLED))
      .mockResolvedValueOnce(ok(DIRECT));

    const database = await createLaneBranch('42', run);

    expect(run).toHaveBeenNthCalledWith(1, 'neonctl', [
      'branches', 'create', '--name', 'lane/42', '--parent', PARENT_BRANCH, '--output', 'json',
    ]);
    expect(database).toEqual({ pooled: POOLED, unpooled: DIRECT });
  });

  it('never branches off production', async () => {
    const run = vi.fn().mockResolvedValue(ok(CREATED));
    await createLaneBranch('42', run).catch(() => undefined);

    for (const [, args] of run.mock.calls) {
      expect(args).not.toContain('production');
    }
  });

  it('fails loudly when neonctl is not installed', async () => {
    await expect(createLaneBranch('42', async () => missing()))
      .rejects.toThrow(/neonctl is not installed/i);
  });

  it('fails loudly when branch creation is rejected', async () => {
    await expect(createLaneBranch('42', async () => failed('quota exceeded')))
      .rejects.toThrow(/quota exceeded/);
  });

  it('rejects a connection string that is not a postgres URI', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce(ok(CREATED))
      .mockResolvedValueOnce(ok('not-a-uri'));

    await expect(createLaneBranch('42', run)).rejects.toThrow(/did not return a postgres/i);
  });

  it('does not leak the connection string into an error message', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce(ok(CREATED))
      .mockResolvedValueOnce(ok('postgresql://leak-canary.lane.invalid/db'))
      .mockResolvedValueOnce(failed('boom'));

    const error = await createLaneBranch('42', run).catch((caught: Error) => caught);
    expect(String(error)).not.toContain('leak-canary');
  });
});

describe('deleteLaneBranch', () => {
  it('deletes the lane branch', async () => {
    const run = vi.fn().mockResolvedValue(ok(''));
    await deleteLaneBranch('42', run);
    expect(run).toHaveBeenCalledWith('neonctl', ['branches', 'delete', 'lane/42']);
  });

  it('is idempotent when the branch is already gone', async () => {
    await expect(deleteLaneBranch('42', async () => failed('not found'))).resolves.toBeUndefined();
  });

  it('rethrows a failure that is not a missing branch', async () => {
    await expect(deleteLaneBranch('42', async () => failed('permission denied')))
      .rejects.toThrow(/permission denied/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/neon`
Expected: FAIL — `Cannot find module './neon.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/preflight/src/lane/neon.ts
import { type CommandOutcome, runCommand } from '../exec.js';

/**
 * Lanes branch off `dev`, never `production`. Project law: the application
 * database is a Neon branch, and nothing local may point at production.
 */
export const PARENT_BRANCH = 'dev';

export function laneBranchName(ticket: string): string {
  return `lane/${ticket}`;
}

export interface LaneDatabase {
  readonly pooled: string;
  readonly unpooled: string;
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
) => Promise<CommandOutcome>;

const NEONCTL_TIMEOUT_MS = 60_000;

const defaultRunner: CommandRunner = (command, args) =>
  runCommand(command, args, NEONCTL_TIMEOUT_MS);

function requireNeonctl(outcome: CommandOutcome, action: string): void {
  if (outcome.status === 'missing') {
    throw new Error(`neonctl is not installed, so ${action} is impossible. Install it and re-run.`);
  }

  if (outcome.status === 'failed') {
    throw new Error(`neonctl could not ${action}: ${outcome.stderr || 'no stderr'}`);
  }
}

/**
 * Reads a connection string. The value is a live credential: it is returned to
 * the caller and never logged, never interpolated into an error message.
 */
async function connectionString(
  branch: string,
  pooled: boolean,
  run: CommandRunner,
): Promise<string> {
  const outcome = await run('neonctl', [
    'connection-string', branch, ...(pooled ? ['--pooled'] : []),
  ]);
  requireNeonctl(outcome, `read the ${pooled ? 'pooled' : 'direct'} connection string for ${branch}`);

  const value = outcome.stdout.trim();
  if (!value.startsWith('postgres://') && !value.startsWith('postgresql://')) {
    throw new Error(`neonctl did not return a postgres URI for ${branch}`);
  }

  return value;
}

export async function createLaneBranch(
  ticket: string,
  run: CommandRunner = defaultRunner,
): Promise<LaneDatabase> {
  const branch = laneBranchName(ticket);

  const created = await run('neonctl', [
    'branches', 'create', '--name', branch, '--parent', PARENT_BRANCH, '--output', 'json',
  ]);
  requireNeonctl(created, `create branch ${branch}`);

  return {
    pooled: await connectionString(branch, true, run),
    unpooled: await connectionString(branch, false, run),
  };
}

/** Idempotent: a branch that is already gone is the desired end state. */
export async function deleteLaneBranch(
  ticket: string,
  run: CommandRunner = defaultRunner,
): Promise<void> {
  const branch = laneBranchName(ticket);
  const outcome = await run('neonctl', ['branches', 'delete', branch]);

  if (outcome.status === 'ok' || outcome.status === 'missing') return;
  if (/not found|does not exist/i.test(outcome.stderr)) return;

  throw new Error(`neonctl could not delete branch ${branch}: ${outcome.stderr}`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/neon`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/preflight/src/lane/neon.ts packages/preflight/src/lane/neon.test.ts
git commit -m "feat: Create and delete per-lane Neon branches"
```

---

### Task 5: Lane environment file and child environment

The override channel. `packages/db/src/load-env.ts` reads only the repo-root `.env` and a package-local `.env` — never `.env.local` — and dotenv declines to overwrite variables already present in the real process environment. Setting values in the child's environment is therefore the only override that reliably reaches both the Fastify API and Next.js.

**Files:**
- Create: `packages/preflight/src/lane/env.ts`
- Test: `packages/preflight/src/lane/env.test.ts`

**Interfaces:**
- Consumes: `LaneManifest` from `./manifest.js`, `LaneDatabase` from `./neon.js`.
- Produces:
  - `LANE_ENV_FILE = '.env.lane'`
  - `renderLaneEnv(manifest: LaneManifest, database: LaneDatabase): string`
  - `parseLaneEnv(contents: string): Record<string, string>`
  - `childEnv(base: NodeJS.ProcessEnv, contents: string): NodeJS.ProcessEnv`

- [ ] **Step 1: Write the failing test**

```ts
// packages/preflight/src/lane/env.test.ts
import { describe, expect, it } from 'vitest';
import { childEnv, parseLaneEnv, renderLaneEnv } from './env.js';
import type { LaneManifest } from './manifest.js';

const manifest: LaneManifest = {
  ticket: '42',
  branch: 'lane/42',
  worktreePath: '/repo/.claude/worktrees/42',
  apiPort: 4007,
  webPort: 3007,
  neonBranch: 'lane/42',
  prUrl: null,
  state: 'active',
  createdAt: '2026-08-28T00:00:00.000Z',
};

const database = {
  pooled: 'postgresql://pooled.lane.invalid/db',
  unpooled: 'postgresql://direct.lane.invalid/db',
};

describe('renderLaneEnv', () => {
  it('points the web app at this lane own API port', () => {
    const parsed = parseLaneEnv(renderLaneEnv(manifest, database));
    expect(parsed.NEXT_PUBLIC_API_URL).toBe('http://localhost:4007');
    expect(parsed.PORT).toBe('4007');
    expect(parsed.WEB_PORT).toBe('3007');
  });

  it('points the database at this lane own Neon branch', () => {
    const parsed = parseLaneEnv(renderLaneEnv(manifest, database));
    expect(parsed.DATABASE_URL).toBe(database.pooled);
    expect(parsed.DATABASE_URL_UNPOOLED).toBe(database.unpooled);
    expect(parsed.NEON_BRANCH).toBe('lane/42');
  });
});

describe('parseLaneEnv', () => {
  it('ignores comments and blank lines', () => {
    expect(parseLaneEnv('# a comment\n\nPORT=4007\n')).toEqual({ PORT: '4007' });
  });

  it('keeps everything after the first equals sign', () => {
    expect(parseLaneEnv('DATABASE_URL=postgresql://h.invalid/db?a=b')).toEqual({
      DATABASE_URL: 'postgresql://h.invalid/db?a=b',
    });
  });
});

describe('childEnv', () => {
  it('lets the lane file win over an inherited value of the same name', () => {
    expect(childEnv({ PORT: '4000' }, 'PORT=4007').PORT).toBe('4007');
  });

  it('preserves inherited variables the lane file does not mention', () => {
    expect(childEnv({ HOME: '/home/dev' }, 'PORT=4007').HOME).toBe('/home/dev');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/env`
Expected: FAIL — `Cannot find module './env.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/preflight/src/lane/env.ts
import type { LaneManifest } from './manifest.js';
import type { LaneDatabase } from './neon.js';

/** Gitignored by the existing `.env.*` rule. Holds live credentials. */
export const LANE_ENV_FILE = '.env.lane';

export function renderLaneEnv(manifest: LaneManifest, database: LaneDatabase): string {
  return [
    `# Lane ${manifest.ticket}. Generated by \`pnpm lane:up\`; do not edit or commit.`,
    `PORT=${manifest.apiPort}`,
    `WEB_PORT=${manifest.webPort}`,
    `NEXT_PUBLIC_API_URL=http://localhost:${manifest.apiPort}`,
    `DATABASE_URL=${database.pooled}`,
    `DATABASE_URL_UNPOOLED=${database.unpooled}`,
    `NEON_BRANCH=${manifest.neonBranch}`,
    '',
  ].join('\n');
}

export function parseLaneEnv(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    values[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }

  return values;
}

/**
 * The lane file WINS over an inherited value. This is the opposite of dotenv's
 * precedence, deliberately: the file exists to override, and a lane launched
 * from a shell that had already sourced the root `.env` would otherwise bind
 * the shared ports and silently lose its isolation.
 */
export function childEnv(base: NodeJS.ProcessEnv, contents: string): NodeJS.ProcessEnv {
  return { ...base, ...parseLaneEnv(contents) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/env`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/preflight/src/lane/env.ts packages/preflight/src/lane/env.test.ts
git commit -m "feat: Render lane env file and child environment"
```

---

### Task 6: The lane CLI

**Files:**
- Create: `packages/preflight/src/lane/cli.ts`
- Test: `packages/preflight/src/lane/cli.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5.
- Produces:
  - `parseLaneArgs(argv: readonly string[]): LaneCommand`
  - `type LaneCommand = { kind: 'up' | 'down'; ticket: string } | { kind: 'exec'; ticket: string; command: readonly string[] }`
  - `laneUp(mainCheckout: string, worktreePath: string, ticket: string, deps?: LaneUpDeps): Promise<LaneManifest>`
  - `laneDown(mainCheckout: string, worktreePath: string, ticket: string, deps?: LaneDownDeps): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// packages/preflight/src/lane/cli.test.ts
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { laneDown, laneUp, parseLaneArgs } from './cli.js';
import { claimManifest, readManifest } from './manifest.js';
import { parseLaneEnv } from './env.js';

let root: string;
let worktree: string;

const database = {
  pooled: 'postgresql://pooled.lane.invalid/db',
  unpooled: 'postgresql://direct.lane.invalid/db',
};

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'lane-cli-'));
  worktree = mkdtempSync(path.join(tmpdir(), 'lane-wt-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(worktree, { recursive: true, force: true });
});

describe('parseLaneArgs', () => {
  it('parses up and down', () => {
    expect(parseLaneArgs(['up', '42'])).toEqual({ kind: 'up', ticket: '42' });
    expect(parseLaneArgs(['down', '42'])).toEqual({ kind: 'down', ticket: '42' });
  });

  it('parses exec and keeps the command after the separator', () => {
    expect(parseLaneArgs(['exec', '42', '--', 'pnpm', 'dev'])).toEqual({
      kind: 'exec', ticket: '42', command: ['pnpm', 'dev'],
    });
  });

  it('rejects an unknown subcommand', () => {
    expect(() => parseLaneArgs(['sideways', '42'])).toThrow(/unknown/i);
  });

  it('rejects a missing ticket', () => {
    expect(() => parseLaneArgs(['up'])).toThrow(/ticket/i);
  });

  it('rejects exec with no command', () => {
    expect(() => parseLaneArgs(['exec', '42', '--'])).toThrow(/command/i);
  });
});

describe('laneUp', () => {
  const deps = () => ({
    createBranch: vi.fn().mockResolvedValue(database),
    probe: vi.fn().mockResolvedValue(true),
    install: vi.fn().mockResolvedValue(undefined),
    migrate: vi.fn().mockResolvedValue(undefined),
  });

  it('writes a manifest and an env file that agree on the ports', async () => {
    const d = deps();
    const manifest = await laneUp(root, worktree, '42', d);

    expect(readManifest(root, '42')).toEqual(manifest);

    const parsed = parseLaneEnv(readFileSync(path.join(worktree, '.env.lane'), 'utf8'));
    expect(parsed.PORT).toBe(String(manifest.apiPort));
    expect(parsed.NEXT_PUBLIC_API_URL).toBe(`http://localhost:${manifest.apiPort}`);
  });

  it('installs and migrates exactly once', async () => {
    const d = deps();
    await laneUp(root, worktree, '42', d);
    expect(d.install).toHaveBeenCalledTimes(1);
    expect(d.migrate).toHaveBeenCalledTimes(1);
  });

  it('resumes an existing lane without creating a second Neon branch', async () => {
    const d = deps();
    const first = await laneUp(root, worktree, '42', d);

    const second = await laneUp(root, worktree, '42', d);
    expect(second).toEqual(first);
    expect(d.createBranch).toHaveBeenCalledTimes(1);
  });

  it('never hands two lanes the same offset', async () => {
    const d = deps();
    const a = await laneUp(root, worktree, '42', d);
    const b = await laneUp(root, worktree, '43', d);
    expect(a.apiPort).not.toBe(b.apiPort);
    expect(a.webPort).not.toBe(b.webPort);
  });
});

describe('laneDown', () => {
  it('deletes the Neon branch, the env file, and the manifest', async () => {
    const up = {
      createBranch: vi.fn().mockResolvedValue(database),
      probe: vi.fn().mockResolvedValue(true),
      install: vi.fn().mockResolvedValue(undefined),
      migrate: vi.fn().mockResolvedValue(undefined),
    };
    await laneUp(root, worktree, '42', up);

    const deleteBranch = vi.fn().mockResolvedValue(undefined);
    await laneDown(root, worktree, '42', { deleteBranch });

    expect(deleteBranch).toHaveBeenCalledWith('42');
    expect(existsSync(path.join(worktree, '.env.lane'))).toBe(false);
    expect(readManifest(root, '42')).toBeNull();
  });

  it('is idempotent for a lane that was never up', async () => {
    const deleteBranch = vi.fn().mockResolvedValue(undefined);
    await expect(laneDown(root, worktree, 'ghost', { deleteBranch })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/cli`
Expected: FAIL — `Cannot find module './cli.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/preflight/src/lane/cli.ts
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runCommand } from '../exec.js';
import { childEnv, LANE_ENV_FILE, renderLaneEnv } from './env.js';
import {
  claimManifest, type LaneManifest, readManifest, readManifests, removeManifest, withLock,
} from './manifest.js';
import { createLaneBranch, deleteLaneBranch, type LaneDatabase, laneBranchName } from './neon.js';
import { allocateOffset, API_BASE, type PortProbe, WEB_BASE } from './ports.js';

export type LaneCommand =
  | { readonly kind: 'up' | 'down'; readonly ticket: string }
  | { readonly kind: 'exec'; readonly ticket: string; readonly command: readonly string[] };

export function parseLaneArgs(argv: readonly string[]): LaneCommand {
  const [kind, ticket, ...rest] = argv;

  if (kind !== 'up' && kind !== 'down' && kind !== 'exec') {
    throw new Error(`Unknown lane subcommand: ${kind ?? '(none)'}. Expected up, down or exec.`);
  }
  if (!ticket) {
    throw new Error(`lane ${kind} requires a ticket identifier.`);
  }
  if (kind !== 'exec') {
    return { kind, ticket };
  }

  const separator = rest.indexOf('--');
  const command = separator === -1 ? rest : rest.slice(separator + 1);
  if (command.length === 0) {
    throw new Error('lane exec requires a command after `--`.');
  }

  return { kind, ticket, command };
}

export interface LaneUpDeps {
  readonly createBranch: (ticket: string) => Promise<LaneDatabase>;
  readonly probe: PortProbe;
  readonly install: (worktreePath: string) => Promise<void>;
  readonly migrate: (worktreePath: string) => Promise<void>;
}

async function runIn(worktreePath: string, args: readonly string[]): Promise<void> {
  const outcome = await runCommand('pnpm', ['-C', worktreePath, ...args], 600_000);
  if (outcome.status !== 'ok') {
    throw new Error(`\`pnpm ${args.join(' ')}\` failed in ${worktreePath}: ${outcome.stderr}`);
  }
}

const defaultUpDeps: LaneUpDeps = {
  createBranch: (ticket) => createLaneBranch(ticket),
  probe: undefined as unknown as PortProbe, // allocateOffset falls back to isPortFree
  install: (worktreePath) => runIn(worktreePath, ['install']),
  migrate: (worktreePath) => runIn(worktreePath, ['db:migrate']),
};

export async function laneUp(
  mainCheckout: string,
  worktreePath: string,
  ticket: string,
  deps: LaneUpDeps = defaultUpDeps,
): Promise<LaneManifest> {
  const existing = readManifest(mainCheckout, ticket);
  if (existing) return existing;

  // The lock spans read-claimed-ports through write-manifest: without it two
  // lanes read the same claimed set and pick the same offset.
  const { manifest, database } = await withLock(mainCheckout, async () => {
    const again = readManifest(mainCheckout, ticket);
    if (again) return { manifest: again, database: null };

    const claimed = new Set(readManifests(mainCheckout).map((lane) => lane.apiPort - API_BASE));
    const offset = await allocateOffset(ticket, claimed, deps.probe);
    const created = await deps.createBranch(ticket);

    const next: LaneManifest = {
      ticket,
      branch: laneBranchName(ticket),
      worktreePath,
      apiPort: API_BASE + offset,
      webPort: WEB_BASE + offset,
      neonBranch: laneBranchName(ticket),
      prUrl: null,
      state: 'active',
      createdAt: new Date().toISOString(),
    };

    claimManifest(mainCheckout, next);
    return { manifest: next, database: created };
  });

  if (!database) return manifest;

  writeFileSync(path.join(worktreePath, LANE_ENV_FILE), renderLaneEnv(manifest, database), {
    mode: 0o600,
  });

  await deps.install(worktreePath);
  await deps.migrate(worktreePath);

  return manifest;
}

export interface LaneDownDeps {
  readonly deleteBranch: (ticket: string) => Promise<void>;
}

const defaultDownDeps: LaneDownDeps = { deleteBranch: (ticket) => deleteLaneBranch(ticket) };

export async function laneDown(
  mainCheckout: string,
  worktreePath: string,
  ticket: string,
  deps: LaneDownDeps = defaultDownDeps,
): Promise<void> {
  await deps.deleteBranch(ticket);
  rmSync(path.join(worktreePath, LANE_ENV_FILE), { force: true });
  removeManifest(mainCheckout, ticket);
}

export function laneExec(worktreePath: string, command: readonly string[]): never | void {
  const file = path.join(worktreePath, LANE_ENV_FILE);
  if (!existsSync(file)) {
    throw new Error(`No ${LANE_ENV_FILE} in ${worktreePath}. Run \`pnpm lane:up\` first.`);
  }

  const [executable, ...args] = command;
  const child = spawn(executable, args, {
    cwd: worktreePath,
    stdio: 'inherit',
    env: childEnv(process.env, readFileSync(file, 'utf8')),
  });

  child.on('exit', (code) => process.exit(code ?? 1));
}
```

Add the entry point at the end of the file:

```ts
if (process.argv[1]?.endsWith('lane/cli.ts')) {
  const parsed = parseLaneArgs(process.argv.slice(2));
  const mainCheckout = process.env.LANE_MAIN_CHECKOUT ?? process.cwd();
  const worktree = process.cwd();

  if (parsed.kind === 'up') {
    await laneUp(mainCheckout, worktree, parsed.ticket);
  } else if (parsed.kind === 'down') {
    await laneDown(mainCheckout, worktree, parsed.ticket);
  } else {
    laneExec(worktree, parsed.command);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/cli`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the whole package suite and typecheck**

Run: `pnpm --filter @vendor-marketplace/preflight test && pnpm --filter @vendor-marketplace/preflight typecheck && pnpm --filter @vendor-marketplace/preflight lint`
Expected: all green. Fix any `any` or unused-import findings before committing.

- [ ] **Step 6: Commit**

```bash
git add packages/preflight/src/lane/cli.ts packages/preflight/src/lane/cli.test.ts
git commit -m "feat: Add the lane up, down and exec CLI"
```

---

### Task 7: Wire the lane tooling into the repository

> **BLOCKED until the peer session commits.** This task modifies `package.json`, which `vendor-marketplace-83` currently holds dirty. Confirm `git status --short` shows no foreign modifications before starting.

**Files:**
- Modify: `package.json` (root scripts)
- Modify: `apps/web/package.json` (dev script)
- Modify: `.gitignore`
- Modify: `.claude/settings.json`
- Test: `packages/preflight/src/lane/wiring.test.ts` (new — asserts the wiring, since a script entry has no other test)

**Interfaces:**
- Consumes: `packages/preflight/src/lane/cli.ts` from Task 6.
- Produces: `pnpm lane:up`, `pnpm lane:down`, `pnpm lane:exec`.

- [ ] **Step 1: Write the failing test**

An executable guard beats a written rule: this test is what stops the wiring from silently regressing.

```ts
// packages/preflight/src/lane/wiring.test.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../../..');
const json = (relative: string) =>
  JSON.parse(readFileSync(path.join(repoRoot, relative), 'utf8')) as Record<string, never>;

describe('lane wiring', () => {
  it('exposes lane:up, lane:down and lane:exec from the repository root', () => {
    const scripts = json('package.json').scripts as unknown as Record<string, string>;
    expect(scripts['lane:up']).toContain('lane/cli.ts');
    expect(scripts['lane:down']).toContain('lane/cli.ts');
    expect(scripts['lane:exec']).toContain('lane/cli.ts');
  });

  it('lets the web dev server take a lane-specific port', () => {
    const scripts = json('apps/web/package.json').scripts as unknown as Record<string, string>;
    expect(scripts.dev).toContain('WEB_PORT');
    expect(scripts.dev).toContain('3000');
  });

  it('ignores the lane manifest directory', () => {
    expect(readFileSync(path.join(repoRoot, '.gitignore'), 'utf8')).toContain('.claude/lanes/');
  });

  it('does not symlink node_modules into worktrees', () => {
    const settings = json('.claude/settings.json') as unknown as {
      worktree?: { symlinkDirectories?: string[] };
    };
    expect(settings.worktree?.symlinkDirectories).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/wiring`
Expected: FAIL on all four assertions.

- [ ] **Step 3: Add the root scripts**

In `package.json`, after the `"smoke"` entry:

```json
"lane:up": "pnpm --filter @vendor-marketplace/preflight exec tsx src/lane/cli.ts up",
"lane:down": "pnpm --filter @vendor-marketplace/preflight exec tsx src/lane/cli.ts down",
"lane:exec": "pnpm --filter @vendor-marketplace/preflight exec tsx src/lane/cli.ts exec",
```

- [ ] **Step 4: Give the web dev server a lane port**

In `apps/web/package.json`, replace `"dev": "next dev"` with:

```json
"dev": "next dev -p ${WEB_PORT:-3000}",
```

The default keeps non-lane development on 3000 unchanged.

- [ ] **Step 5: Ignore the manifest directory**

Append to `.gitignore`, next to the existing `.claude/worktrees/` entry:

```gitignore
# Lane manifests: per-lane coordination state, written by `pnpm lane:up`.
.claude/lanes/
```

`.env.lane` needs no entry — the existing `.env.*` rule on line 13 already covers it. Confirm with `git check-ignore -v .env.lane`.

- [ ] **Step 6: Remove the node_modules symlink**

In `.claude/settings.json`, delete the `symlinkDirectories` key so `worktree` reads:

```json
"worktree": {
  "baseRef": "fresh"
},
```

Only the root `node_modules` was ever symlinked; `apps/*/node_modules` and `packages/*/node_modules` are separate real directories a worktree never received, so workspace resolution was incomplete in every lane and the only in-lane fix wrote through the symlink into shared state. pnpm hardlinks from the store at `~/Library/pnpm/store/v10`, so a real per-lane install is cheap and safe.

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @vendor-marketplace/preflight test -- lane/wiring`
Expected: PASS, 4 tests.

- [ ] **Step 8: Prove a real worktree installs and boots**

```bash
git worktree add .claude/worktrees/lane-smoke -b lane/smoke
cp .env .env.e2e.local .claude/worktrees/lane-smoke/ 2>/dev/null || true
pnpm -C .claude/worktrees/lane-smoke install
pnpm -C .claude/worktrees/lane-smoke typecheck
```

Expected: install completes and typecheck passes without the symlink. Then clean up:

```bash
git worktree remove .claude/worktrees/lane-smoke --force
git branch -D lane/smoke
```

- [ ] **Step 9: Commit**

```bash
git add package.json apps/web/package.json .gitignore .claude/settings.json \
        packages/preflight/src/lane/wiring.test.ts
git commit -m "feat: Wire lane tooling and drop the node_modules symlink"
```

---

### Task 8: Make `main` structurally unbreakable

> **BLOCKED until the peer session commits.** This task modifies `.github/workflows/ci.yml`, which `vendor-marketplace-83` currently holds dirty (it is adding a `test:agents` step). Rebase onto their version rather than reverting it.

Auto-merge alone is not enough: two lanes can each be green against an older `main`, both merge, and `main` breaks with neither PR ever red. The merge queue rebuilds each PR against `main` plus everything ahead of it.

**Files:**
- Modify: `.github/workflows/ci.yml`
- GitHub repository settings and one `main` ruleset (no local file)

- [ ] **Step 1: Add the `merge_group` trigger**

In `.github/workflows/ci.yml`, extend the `on:` block:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  # The merge queue builds each PR on a temporary `gh-readonly-queue/**` branch.
  # Without this trigger the required check never runs there and the queue
  # blocks forever on a check that cannot arrive.
  merge_group:
```

Leave `concurrency` as it is — it keys on `github.ref` and stays correct for queue branches.

- [ ] **Step 2: Verify the workflow still parses**

Run: `gh workflow view CI` (or `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`)
Expected: no parse error, and the `merge_group` trigger is present.

- [ ] **Step 3: Enable auto-merge and branch deletion**

```bash
gh repo edit --enable-auto-merge --delete-branch-on-merge
gh api repos/{owner}/{repo} --jq '{allow_auto_merge,delete_branch_on_merge}'
```

Expected: both `true`. They are both `false` today, which is why `gh pr merge --auto` would fail outright.

- [ ] **Step 4: Create the `main` ruleset**

The required check's context is the job's `name:` value in `ci.yml` — currently `Typecheck, lint, build, test`. Confirm it before running this, because a context that does not match blocks every merge forever:

```bash
gh api repos/{owner}/{repo}/rulesets --method POST --input - <<'JSON'
{
  "name": "main-merge-queue",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [ { "context": "Typecheck, lint, build, test" } ]
      }
    },
    {
      "type": "merge_queue",
      "parameters": {
        "merge_method": "SQUASH",
        "grouping_strategy": "ALLGREEN",
        "max_entries_to_build": 5,
        "min_entries_to_merge": 1,
        "max_entries_to_merge": 5,
        "min_entries_to_merge_wait_minutes": 0,
        "check_response_timeout_minutes": 60
      }
    }
  ]
}
JSON
```

No reviewer rule: this is CI-only and adds no review ceremony. `strict_required_status_checks_policy` is `false` because the queue itself handles freshness.

- [ ] **Step 5: Prove the queue actually works before any lane depends on it**

```bash
git switch -c lane/queue-proof
printf '\n' >> README.md && git commit -am "chore: Prove the merge queue runs CI"
git push -u origin lane/queue-proof
gh pr create --base main --head lane/queue-proof --title "Prove the merge queue" --body "Throwaway."
gh pr merge --squash --auto
```

Then watch: `gh pr view --json state,mergeStateStatus` and `gh run list --limit 5`.

Expected: the PR enters the queue, CI runs on a `gh-readonly-queue/**` ref, and the PR merges on green. **If it merges instantly with no queue run, the ruleset is not in force — stop and fix it before Task 10**, because every lane's safety depends on this.

- [ ] **Step 6: Record the outcome**

If merge queue turns out to be unavailable, record that in the spec's *Fallback* section and implement `/land-lanes` in serialized mode (Task 9, Step 4 variant). Do not proceed to Task 10 with neither mechanism in place.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: Run CI for merge queue branches"
```

---

### Task 9: The `/land-lanes` sweep

Asynchronous merging makes this mandatory: without it, worktrees and Neon branches accumulate without bound.

**Files:**
- Create: `~/.claude/skills/land-lanes/SKILL.md`
- Modify: `~/.claude/orchestration-policy.md`

**Interfaces:**
- Consumes: `pnpm lane:down` (Task 7), the manifest shape (Task 2), the merge queue (Task 8).
- Produces: `/land-lanes`, referenced by Tasks 10 and 11.

- [ ] **Step 1: Write the skill**

```markdown
---
name: land-lanes
description: Use when parallel ticket lanes have opened PRs and their merges, cleanup and tracker transitions need to be reconciled.
disable-model-invocation: true
effort: low
---

# Land Lanes

Reconcile every lane in `.claude/lanes/` with the state of its pull request.
Runs in the **main checkout**, which this skill and `/orchestrate` are the only
things permitted to update.

## 1. Refresh

`git -C <main checkout> pull --ff-only`. Stop if it is not fast-forwardable and
say so; never force.

## 2. Reconcile each manifest

For every `.claude/lanes/*.json`, read `prUrl` and query
`gh pr view <prUrl> --json state,mergeCommit,mergeStateStatus,statusCheckRollup`.

| PR state | Action |
| --- | --- |
| `MERGED` | `pnpm lane:down <ticket>`, remove the worktree, move the ticket to Done recording the squash SHA, delete the manifest |
| Dequeued or checks failed | Report the failing job name and its log excerpt. **Keep** the worktree and the Neon branch so `/ticket <id>` resumes in place. Set `state: failed` |
| `OPEN`, queued or running | Report as waiting. Take no action |
| No `prUrl`, worktree dirty | Report as abandoned work. **Never** delete it |

## 3. Report orphans

Name any Neon branch matching `lane/*` with no manifest, and any worktree under
`.claude/worktrees/` with no manifest. Report them; do not delete them. They are
usually a lane that died mid-flight and still holds work.

## 4. Serialized fallback

Only when the merge queue is unavailable. One lane at a time, never in parallel:
update the branch onto `main`, watch CI with `gh run watch <id> --exit-status`,
merge on green, then move to the next. Slower, identical guarantee.

## 5. Report

One line per lane: ticket, PR, outcome. Then a fleet line: landed, waiting,
failed, orphaned.
```

- [ ] **Step 2: Add `PENDING_MERGE` to the status record**

In `~/.claude/orchestration-policy.md`, change the status record block to:

```text
STATUS: COMPLETED | PENDING_MERGE | BLOCKED | FAILED | QUEUE_EMPTY
TICKET: <identifier or NONE>
COMMIT: <sha or NONE>
PR: <url or NONE>
PUSHED: main | branch | NO
CHECKS: <passed checks or NONE>
REVIEW: <diff-reviewer verdict | not-run>
BROWSER: verified | not-applicable
PARITY: <frame ids verified | not-applicable>
WORKTREE: clean | dirty
CI: green | red | queued | not-run
MESSAGE: <one line>
```

And add below it:

```markdown
`PENDING_MERGE` is the normal terminal state for a lane: the work is delivered,
the PR is enqueued, and the merge has not yet been observed. `COMPLETED` is for
`--no-worktree` tickets that land on `main` directly, and for lanes that
`/land-lanes` has confirmed merged.
```

- [ ] **Step 3: Update the ticket lifecycle section**

Replace the `READY -> IN_PROGRESS -> DONE` block's last bullet with:

```markdown
- Done only after the merge is **observed** — by `/land-lanes` for a lane, or by
  a verified commit on remote `main` with green CI for a `--no-worktree` ticket.
  A lane returning `PENDING_MERGE` has not reached Done.
```

- [ ] **Step 4: Verify the skill loads**

Run: `ls ~/.claude/skills/land-lanes/SKILL.md && head -6 ~/.claude/skills/land-lanes/SKILL.md`
Expected: frontmatter shows `name: land-lanes`.

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add skills/land-lanes/SKILL.md orchestration-policy.md
git commit -m "feat: Add the land-lanes sweep and PENDING_MERGE state"
```

---

### Task 10: Default to worktrees, and deliver without waiting

**Files:**
- Modify: `~/.claude/skills/ticket/SKILL.md`
- Modify: `~/.claude/skills/next-ticket/SKILL.md`
- Modify: `~/.claude/skills/ticket/references/workflow.md`
- Modify: `~/.claude/skills/verify-and-ship/SKILL.md`
- Modify: `~/.claude/skills/start/SKILL.md`

- [ ] **Step 1: Flip the flag in both entry-point skills**

In `ticket/SKILL.md`, replace the `--worktree` paragraph with:

```markdown
Require exactly one ticket identifier in `$ARGUMENTS`. **Ticket execution runs in
an isolated git worktree by default.** Pass `--no-worktree` to run on the default
branch instead — for documentation-only tickets, tracker edits, and hotfixes that
must land directly. `--worktree` and `--isoworktree` are accepted as no-ops.

Read `references/workflow.md` completely, then execute it with selection mode
`explicit`, the supplied identifier, and `worktree_mode` set to `false` only when
`--no-worktree` is present.
```

Make the equivalent change in `next-ticket/SKILL.md`, with selection mode `next`.

- [ ] **Step 2: Rewrite workflow.md section 2**

Replace the whole of section 2's worktree block with:

```markdown
### Worktree mode (the default)

1. Ensure the default branch is current in the **main checkout**: `git pull --ff-only`.
   This is the only thing a lane does to the main checkout, and it is read-only
   afterwards.
2. `claude --worktree <ticket-id>`, or `EnterWorktree` from inside the session.
   The worktree lands at `.claude/worktrees/<ticket-id>/` on a branch off `main`.
3. Confirm `.worktreeinclude` covers the gitignored files the lane needs
   (`.env`, `.env.local`, `.env.e2e.local`, `.neon`). Without it the lane has no
   environment and nothing boots. A missing entry is a workflow defect, not a
   ticket blocker — fix it before going further.
4. **`pnpm lane:up <ticket-id>`.** This allocates a collision-free port pair,
   creates a `lane/<ticket-id>` Neon branch off `dev`, writes `.env.lane`,
   installs, and migrates. Do **not** hand-derive a port offset; that rule was
   never executed and lanes silently shared one API.
5. Run every lane command through **`pnpm lane:exec <ticket-id> -- <command>`**.
   `packages/db/src/load-env.ts` reads only the root and package `.env`, so this
   is the only override channel that reaches both apps.

### Standard mode (`--no-worktree`)

Require the default branch, a clean tree, and a configured remote.
`git pull --ff-only`.
```

- [ ] **Step 3: Attach the skills at their steps**

In workflow.md, add to **section 3 (plan)**:

```markdown
When the ticket is ambiguous, or spans more than three packages, run
`superpowers:brainstorming` and then `writing-plans` before implementing.
A routine ticket should not pay that ceremony — go straight to section 4.
```

Add to **section 4 (implement)**, before the numbered list:

```markdown
Follow `superpowers:test-driven-development` for the loop below, and
`karpathy-guidelines` throughout — its *Surgical Changes* rule is the direct
lever on parallel throughput: scope creep is what makes two lanes touch one file
and collide at merge. For new or reshaped UI, read `frontend-design` before
writing the component, not after `parity-checker` rejects it.

If two attempts at the same failure have not fixed it, stop guessing and invoke
`superpowers:systematic-debugging`.
```

Add to **section 7 (verify and deliver)**, before the existing text:

```markdown
Run `superpowers:verification-before-completion` before emitting the status
record. Evidence before assertions: `CHECKS` lists checks whose output you read.
```

And replace the worktree-cleanup block with:

```markdown
### Worktree cleanup

**The lane does not clean itself up.** It exits at `PENDING_MERGE` with its PR
enqueued; `/land-lanes` observes the merge, runs `pnpm lane:down`, removes the
worktree, and moves the ticket to Done with the squash SHA. Leaving the worktree
in place is what makes a failed lane resumable.
```

- [ ] **Step 4: Rewrite verify-and-ship worktree delivery**

In `verify-and-ship/SKILL.md`, replace the `### Worktree mode` block with:

```markdown
### Worktree mode (the default)

1. Record on the lane branch.
2. `git push -u origin <branch>`.
3. `gh pr create --base main --head <branch>` with the ticket context.
4. `gh pr merge --squash --auto` — this **enqueues**; it does not merge now.
5. Write the PR URL into `.claude/lanes/<ticket>.json` and set
   `state: pending-merge`.
6. Return `PENDING_MERGE`. **Do not wait for CI, do not merge, do not remove the
   worktree.** The merge queue rebuilds the PR against `main` plus everything
   ahead of it, which is what makes it impossible for two independently green
   lanes to break `main`. `/land-lanes` finishes the job.
```

Then replace the "Confirm CI, do not assume it" section's opening so it applies only to standard mode:

```markdown
## Confirm CI, do not assume it

**Standard mode only.** A push is not a delivery until remote CI is green: find
the run for that SHA and watch it with `gh run watch <id> --exit-status`.

In worktree mode the merge queue owns this, and the lane exits before it
completes. `/land-lanes` reports the outcome.
```

- [ ] **Step 5: Point `start` at lane:exec**

In `start/SKILL.md`, replace the final lane paragraph with:

```markdown
When running as one lane of a parallel set, start every process through
`pnpm lane:exec <ticket-id> -- <command>` so it inherits the lane's ports and
its own Neon branch. Never start a lane's servers with the base ports. Report
which ports you bound.
```

- [ ] **Step 6: Verify the flag actually flipped**

Run: `grep -n "no-worktree" ~/.claude/skills/ticket/SKILL.md ~/.claude/skills/next-ticket/SKILL.md`
Expected: both files mention `--no-worktree` as the escape hatch.

Run: `grep -c "lane:exec" ~/.claude/skills/ticket/references/workflow.md`
Expected: at least 1.

- [ ] **Step 7: Commit**

```bash
cd ~/.claude
git add skills/ticket skills/next-ticket skills/verify-and-ship skills/start
git commit -m "feat: Default ticket execution to isolated worktree lanes"
```

---

### Task 11: Teach `/orchestrate` the new fleet

**Files:**
- Modify: `~/.claude/skills/orchestrate/SKILL.md`

- [ ] **Step 1: Replace the fleet preflight checklist**

```markdown
- [ ] `.worktreeinclude` covers the gitignored files a lane needs.
- [ ] The default branch is current and the tree is clean.
- [ ] **No other interactive session holds uncommitted work.** Check with
      `ListAgents` and `git status --short`. A peer session editing the same
      checkout is the same hazard lanes exist to remove.
- [ ] CI is green on the default branch right now.
- [ ] **The `main` ruleset is active with merge queue and the required check.**
      `gh api repos/{owner}/{repo}/rulesets --jq '.[].name'` — an empty result
      means `--auto` merges instantly and lanes can break `main`. Stop.
- [ ] **Auto-merge is enabled.** `gh api repos/{owner}/{repo} --jq .allow_auto_merge`
- [ ] **`ci.yml` has a `merge_group:` trigger,** or the queue blocks forever.
- [ ] **`neonctl` is authenticated.** `neonctl branches list` succeeds and shows `dev`.
- [ ] **`.claude/lanes/` holds no stale manifests.** Run `/land-lanes` first if it does.
```

- [ ] **Step 2: Give the independence check teeth**

Replace the file-overlap paragraph in section 2 with:

```markdown
Send `Explore` to return each candidate ticket's predicted file set — do not
trust the ticket's own prose, which goes stale as soon as another ticket touches
the same files. **Two candidates whose file sets intersect are not both
dispatched:** take the higher-priority one and leave the other queued. This is
the failure mode the whole approach exists to avoid.

A ticket that changes dependencies may be dispatched normally — lanes install
into their own `node_modules` — but a ticket that changes a shared Zod contract
in `packages/shared` conflicts with everything downstream of it. Run those solo.
```

- [ ] **Step 3: Replace dispatch and landing**

```markdown
## 3. Dispatch

Prefer three lanes; five is the ceiling. Beyond that, coordination overhead and
browser resource contention grow faster than throughput.

    claude --bg --name "<ticket-id>" --worktree "<ticket-id>" "/ticket <ticket-id>"

Worktree mode is now the default, so no flag is needed. Each lane runs
`pnpm lane:up` itself and gets its own ports and Neon branch. Do not implement
any lane yourself while lanes are running — supervise.

## 5. Land

Do not merge by hand. Every lane enqueues its own PR and exits at
`PENDING_MERGE`; the merge queue serialises the merges and re-tests each against
everything ahead of it. Run **`/land-lanes`** to reconcile: it cleans up merged
lanes, keeps failed ones resumable, and reports what is still in flight.
```

- [ ] **Step 4: Verify**

Run: `grep -n "land-lanes\|merge_group\|rulesets" ~/.claude/skills/orchestrate/SKILL.md`
Expected: all three appear.

- [ ] **Step 5: Commit**

```bash
cd ~/.claude
git add skills/orchestrate/SKILL.md
git commit -m "feat: Preflight the merge queue and lane independence"
```

---

### Task 12: Document lanes in the project CLAUDE.md

> **BLOCKED until the peer session commits.** `CLAUDE.md` is currently dirty.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the lane commands to the Commands table**

After the `Secret scan` row:

```markdown
| Bring a lane up | `pnpm lane:up <ticket-id>` (in the worktree)                                                  |
| Run in a lane   | `pnpm lane:exec <ticket-id> -- <command>`                                                     |
| Tear a lane down| `pnpm lane:down <ticket-id>`                                                                  |
```

- [ ] **Step 2: Add the parallel-execution law**

Under *Laws that apply everywhere*:

```markdown
- **Ticket work runs in a lane.** `/ticket` and `/next-ticket` default to an
  isolated worktree; `--no-worktree` is the exception. A lane owns its own ports
  and its own `lane/<ticket>` Neon branch off `dev`, brought up by
  `pnpm lane:up`. Every lane command runs through `pnpm lane:exec` — the apps
  read only the root and package `.env`, so nothing else overrides them.
- **A lane never mutates what another lane reads.** Not `node_modules`, not the
  `dev` Neon branch, not the main checkout's working tree. The sole exception is
  its own `.claude/lanes/<ticket>.json`.
- **`main` is never broken.** Lanes never merge; they enqueue. The merge queue
  re-tests every PR against `main` plus everything ahead of it, then merges.
  `/land-lanes` observes the result and moves the ticket to Done.
```

- [ ] **Step 3: Verify and commit**

Run: `grep -n "lane:up\|land-lanes" CLAUDE.md`
Expected: both appear.

```bash
git add CLAUDE.md
git commit -m "docs: Document lane execution and the merge queue"
```

---

### Task 13: Prove three real lanes are isolated

The unit tests prove the parts. This proves the thing.

- [ ] **Step 1: Pick three independent tickets**

Run `/orchestrate 3 --dry-run`. Confirm the table shows three tickets with
non-intersecting file sets and that every preflight box is checked.

- [ ] **Step 2: Dispatch**

Run `/orchestrate 3`.

- [ ] **Step 3: Assert port isolation — the defect that exists today**

While all three lanes are running their dev servers:

```bash
for f in .claude/lanes/*.json; do
  node -e "const m=require('./'+process.argv[1]); console.log(m.ticket, m.webPort, m.apiPort)" "$f"
done
```

Then, for each lane, confirm its web app calls **its own** API:

```bash
pnpm lane:exec <ticket> -- node -e "console.log(process.env.NEXT_PUBLIC_API_URL, process.env.PORT)"
```

Expected: `NEXT_PUBLIC_API_URL` port equals that lane's `apiPort`, and the three
lanes report three distinct pairs. **Before this change every lane reported
`http://localhost:4000`.**

- [ ] **Step 4: Assert database isolation**

In lane A, create a record through the UI. In lanes B and C, confirm it is not
visible. Confirm `neonctl branches list` shows three `lane/*` branches.

- [ ] **Step 5: Assert the queue serialises**

Watch the three PRs. Expected: each enters the queue, CI runs on a
`gh-readonly-queue/**` ref, and they merge one at a time. `main` is green at
every point.

- [ ] **Step 6: Land and verify cleanup**

Run `/land-lanes`. Expected: three lanes cleaned, three worktrees gone, three
Neon branches deleted, `.claude/lanes/` empty, three tickets Done with SHAs.

- [ ] **Step 7: Close the loop**

For anything that broke, apply the policy's self-improving-workflow ladder — a
regression test first, a hook second, a `.claude/rules/` entry third, and a line
in the workflow files only where no test or hook can reach.

---

## Self-review

**Spec coverage.** Every spec section maps to a task: lane model and manifest → 2; port allocation → 3; Neon branches → 4; `.env.lane` and `lane:exec` → 5; the CLI and the `apps/web` port flag → 6, 7; worktree default → 10; merge queue, repo settings, `merge_group` → 8; `PENDING_MERGE` and `/land-lanes` → 9; skill integration → 1, 10; `/orchestrate` → 11; dependency isolation → 7; docs → 12; testing → every task plus 13.

**Placeholders.** None. Every code step carries the actual code; every verification step carries the command and its expected output.

**Type consistency.** `LaneManifest` is defined once in Task 2 and imported by 5, 6, 7. `LaneDatabase` and `CommandRunner` are defined in Task 4 and consumed in 5, 6. `PortProbe` is defined in Task 3 and consumed in 6. `laneBranchName` is used for both `branch` and `neonBranch`, deliberately — they carry the same name in different systems.

**Known rough edge.** `defaultUpDeps.probe` is typed via a cast so `allocateOffset` falls back to its own default. If the implementer finds that awkward, make `LaneUpDeps.probe` optional (`probe?: PortProbe`) and pass it through — the tests are unaffected either way.
