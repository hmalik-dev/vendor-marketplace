import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * VEN-696: the only roles are Customer, Vendor and Admin. The retired word for
 * the admin role may not appear in a tracked file outside the exceptions below.
 * The needle is built from fragments so this file does not match its own scan.
 *
 * VEN-697 renamed the persisted identifiers and the environment names, so no
 * token, path or file is excused any more.
 */
const W = ['oper', 'ator'].join('');
const NEEDLE = new RegExp(W, 'i');

const ROOT = resolve(import.meta.dirname, '../../..');

/** Trees and files a match may sit in, each with the reason. */
const ALLOWED_PREFIXES: readonly (readonly [prefix: string, reason: string])[] = [
  ['packages/db/drizzle/', 'applied migrations and snapshots; history is never edited'],
  ['design/', 'the design contract; a design pass edits it, not a ticket'],
  ['.claude/', 'agent notes, plans and memory: dated records'],
  ['pnpm-lock.yaml', 'the resolved dependency graph'],
  ['packages/shared/src/admin-word-guard.test.ts', 'this guard names what it forbids'],
];

interface TrackedFile {
  path: string;
  text: string;
}

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some(([prefix]) => path.startsWith(prefix));
}

function names(file: TrackedFile): boolean {
  return NEEDLE.test(file.path) || NEEDLE.test(file.text);
}

/** Every tracked file outside the allow-list that still names the retired word. */
function violations(files: readonly TrackedFile[]): string[] {
  return files.filter((f) => !isAllowed(f.path) && names(f)).map((f) => f.path);
}

function trackedFiles(): TrackedFile[] {
  const listed = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return listed
    .split('\0')
    .filter(Boolean)
    .map((path) => {
      try {
        const bytes = readFileSync(resolve(ROOT, path));
        return { path, text: bytes.includes(0) ? '' : bytes.toString('utf8') };
      } catch {
        // A tracked path deleted in the working tree; nothing to scan.
        return { path, text: '' };
      }
    });
}

describe('the repo says Admin, never the retired word', () => {
  const files = trackedFiles();

  it('scans the whole tree, so a clean result is not an empty one', () => {
    expect(files.length).toBeGreaterThan(500);
    expect(files.some((f) => f.path === 'apps/api/src/modules/admin/admin.service.ts')).toBe(true);
  });

  it('finds nothing outside the allow-list', () => {
    expect(violations(files)).toEqual([]);
  });

  it('flags the word in a source file, in any case', () => {
    const planted: TrackedFile = {
      path: 'apps/api/src/modules/admin/admin.service.ts',
      text: `// an ${W.toUpperCase()} only route\n`,
    };
    expect(violations([planted])).toEqual([planted.path]);
  });

  it('flags the word in a file name', () => {
    const planted: TrackedFile = { path: `apps/web/src/${W}s-panel.tsx`, text: '' };
    expect(violations([planted])).toEqual([planted.path]);
  });

  it('flags what VEN-697 renamed: env names, stored values, GUCs, paths and legal copy', () => {
    const planted: TrackedFile[] = [
      { path: 'apps/api/src/a.ts', text: `${W.toUpperCase()}_ALERT_EMAIL\n` },
      { path: 'apps/api/src/b.ts', text: `action: '${W}_granted'\n` },
      { path: 'apps/api/src/c.ts', text: `SET LOCAL app.${W}_role_grant = 'on'\n` },
      { path: 'apps/web/src/d.tsx', text: `href: '/admin/${W}s'\n` },
      { path: 'apps/web/content/legal/e.md', text: `an ${W} reads\n` },
      { path: 'apps/api/src/f.ts', text: `'Former ${W[0]!.toUpperCase()}${W.slice(1)}'\n` },
    ];
    expect(violations(planted)).toEqual(planted.map((f) => f.path));
  });

  it('lets the exempt trees keep the word', () => {
    const migration: TrackedFile = { path: 'packages/db/drizzle/0061_x.sql', text: W };
    const design: TrackedFile = { path: 'design/plan.md', text: W };
    expect(violations([migration, design])).toEqual([]);
  });
});
