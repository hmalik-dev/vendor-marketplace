import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * VEN-696: the only roles are Customer, Vendor and Admin. The retired word for
 * the admin role may not appear in a tracked file outside the exceptions below.
 * The needle is built from fragments so this file does not match its own scan.
 *
 * An exception is a **token**, not a line: it is stripped before the scan, so
 * prose beside an allowed identifier is still checked.
 */
const W = ['oper', 'ator'].join('');
const NEEDLE = new RegExp(W, 'i');

const ROOT = resolve(import.meta.dirname, '../../..');

/** Trees and files a match may sit in, each with the reason. */
const ALLOWED_PREFIXES: readonly (readonly [prefix: string, reason: string])[] = [
  ['packages/db/drizzle/', 'applied migrations and snapshots; history is never edited'],
  ['design/', 'the design contract; a design pass edits it, not a ticket'],
  ['.claude/', 'agent notes, plans and memory: dated records'],
  ['apps/web/content/legal/', 'binding copy; its wording is VEN-378 checklist, not a rename'],
  ['pnpm-lock.yaml', 'the resolved dependency graph'],
  ['packages/shared/src/admin-word-guard.test.ts', 'this guard names what it forbids'],
];

/**
 * Persisted identifiers that VEN-697 renames together with a migration. Renaming
 * them in the release that ships the code would break the release still serving,
 * because migrate runs before the API moves.
 */
const PERSISTED_TOKENS: readonly (readonly [pattern: string, reason: string])[] = [
  [`${W.toUpperCase()}_ALERT_EMAIL`, 'environment variable set in the provider consoles'],
  [`${W.toUpperCase()}_TIMEZONE`, 'environment variable set in the provider consoles'],
  [`${W}_granted`, 'admin_action enum value stored in append-only audit rows'],
  [`${W}_revoked`, 'admin_action enum value stored in append-only audit rows'],
  [`${W}_account_closed`, 'admin_action enum value stored in append-only audit rows'],
  [`${W}_alert[a-z_:]*`, 'enum types, table, index names and the advisory lock key'],
  [`${W}_retirement`, 'advisory lock key shared with the release still serving'],
  [`app_is_${W}`, 'row-level-security function created by migrations'],
  [`messages_${W}_select`, 'row-level-security policy created by migrations'],
  [`app\\.${W}(?:_role_grant)?\\b`, 'GUCs the database policies read'],
  [`Former ${W}`, 'data value closure wrote into first_name'],
  [
    `through the ${W} grant path`,
    'exception text raised by the role-change trigger (migration 0069)',
  ],
];

/**
 * The retired console path, where a redirect or a test that pins it lives. It
 * is not a persisted identifier, so it is stripped only in these files.
 */
const LEGACY_PATH = `/admin/${W}s`;
const LEGACY_PATH_FILES: readonly string[] = [
  'apps/web/src/config/legacy-redirects.ts',
  'apps/web/src/config/legacy-redirects.test.ts',
  'apps/web/src/app/route-parity-ledger.test.ts',
];

// Case-sensitive: the stored identifiers are lowercase and the env names uppercase,
// so a renamed code name such as `OPERATOR_ALERT_KINDS` or `app.operatorAlerts` still fails.
const TOKENS = new RegExp(PERSISTED_TOKENS.map(([pattern]) => pattern).join('|'), 'g');

interface TrackedFile {
  path: string;
  text: string;
}

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some(([prefix]) => path.startsWith(prefix));
}

function names(file: TrackedFile): boolean {
  const text = LEGACY_PATH_FILES.includes(file.path)
    ? file.text.replaceAll(LEGACY_PATH, '')
    : file.text;
  return NEEDLE.test(file.path) || NEEDLE.test(text.replace(TOKENS, ''));
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

  it('still flags prose written beside an allowed identifier', () => {
    const planted: TrackedFile = {
      path: 'docs/notes.md',
      text: `${W}_granted is written when an ${W} is added\n`,
    };
    expect(violations([planted])).toEqual([planted.path]);
  });

  it('flags a renamed code name that only starts like a persisted identifier', () => {
    const decorator: TrackedFile = { path: 'apps/api/src/a.ts', text: `app.${W}Alerts\n` };
    const constant: TrackedFile = {
      path: 'apps/api/src/b.ts',
      text: `export const ${W.toUpperCase()}_ALERT_KINDS = []\n`,
    };
    const path: TrackedFile = { path: 'apps/web/src/c.tsx', text: `href: '/admin/${W}s'\n` };
    const name: TrackedFile = {
      path: 'apps/api/src/d.ts',
      text: `'Former ${W[0]!.toUpperCase()}${W.slice(1)}'\n`,
    };
    expect(violations([decorator, constant, path, name])).toEqual([
      decorator.path,
      constant.path,
      path.path,
      name.path,
    ]);
  });

  it('lets the redirect files name the retired console path', () => {
    const redirect: TrackedFile = {
      path: 'apps/web/src/config/legacy-redirects.ts',
      text: `source: '/admin/${W}s'\n`,
    };
    expect(violations([redirect])).toEqual([]);
  });

  it('lets a persisted identifier stand on its own', () => {
    const kept: TrackedFile = {
      path: 'apps/api/src/example.ts',
      text: `action: '${W}_granted'; ${W.toUpperCase()}_TIMEZONE; SET LOCAL app.${W}_role_grant = 'on'\n`,
    };
    expect(violations([kept])).toEqual([]);
  });

  it('lets the exempt trees keep the word', () => {
    const migration: TrackedFile = { path: 'packages/db/drizzle/0061_x.sql', text: W };
    const design: TrackedFile = { path: 'design/plan.md', text: W };
    expect(violations([migration, design])).toEqual([]);
  });
});
