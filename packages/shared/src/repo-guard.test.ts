import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * VEN-449: the repo describes the system that exists. The identity provider
 * (Clerk) was replaced by Neon Auth, so its name may not come back. The needles
 * are built from fragments so this file does not match its own scan, and every
 * exception below names the reason it exists.
 *
 * Cloudflare R2 and MinIO are current infrastructure (VEN-446 hybrid: public
 * images stay on R2, MinIO is the local stand-in), so they are not forbidden.
 */
const NEEDLES = [['cl', 'erk'].join(''), ['sv', 'ix'].join('')];

const ROOT = resolve(import.meta.dirname, '../../..');

/** Trees left as they were written; a match anywhere under one is fine. */
const ALLOWED_PREFIXES: readonly (readonly [prefix: string, reason: string])[] = [
  ['design/uploads/', 'imported design bundles; design re-imports are merges'],
  ['packages/db/drizzle/', 'generated migrations and snapshots; history is never hand-edited'],
  ['.claude/agent-memory/', 'dated reviewer notes, a record of what was true when written'],
  ['.claude/memory/', 'dated project notes, a record of what was true when written'],
];

/** Individual files, each with the reason its match is legitimate. */
const ALLOWED_FILES: Readonly<Record<string, string>> = {
  '.claude/plans/vendor-marketplace-decisions.md': 'the decisions log keeps its history',
  '.claude/plans/vendor-marketplace-plan.md':
    'the original architecture plan, marked superseded at its head',
  'design/Orla-Screens-all.html': 'compiled design export, left as imported',
  'design/delta-legal/Orla-Legal-Surfaces.html': 'compiled design export, left as imported',
  'pnpm-lock.yaml': 'the resolved graph of the webhook-signature package Resend uses',
  'packages/preflight/src/secrets/patterns.ts':
    'the secret scanner still recognises the retired providers key shapes until they are revoked (VEN-377)',
  'packages/preflight/src/secrets/scan.test.ts': 'pins those retired-provider key shapes',
  'packages/shared/src/constants/index.ts':
    'the persisted `auth_provider` enum value for rows the retired provider issued',
  'apps/api/src/modules/auth-sync/identity.ts': 'reads that persisted enum value',
  'apps/api/src/modules/auth-sync/auth-sync.reconcile.test.ts': 'seeds that persisted enum value',
  'apps/api/src/modules/auth-sync/auth-sync.service.test.ts': 'seeds that persisted enum value',
  'apps/api/src/modules/admin/data-rights.routes.test.ts': 'seeds that persisted enum value',
  'packages/db/src/seed-e2e.ts': 're-keys rows carrying that persisted enum value',
  'packages/db/src/seed-e2e.test.ts': 'seeds that persisted enum value',
  'packages/db/src/auth-provider-migration.test.ts':
    'runs migration 0055, which backfills that enum value',
  'packages/db/src/auth-user-id-migration.test.ts':
    'runs migration 0048, which renames the old column',
  'packages/db/src/dedupe-pending-tag-suggestions.test.ts':
    'migrates to before 0048, when the column still had its old name',
  'packages/db/src/drop-style-tags.test.ts':
    'migrates to before 0048, when the column still had its old name',
  'packages/db/src/legal-acceptance-migration.test.ts':
    'migrates to before 0048, when the column still had its old name',
  'packages/db/src/normalise-vendor-state.test.ts':
    'migrates to before 0048, when the column still had its old name',
  'packages/db/src/stripe-onboarded-requires-account.test.ts':
    'migrates to before 0048, when the column still had its old name',
  // Resend signs its webhooks with the Svix protocol: the `svix-*` headers and
  // the `svix` package are its wire contract, not a dependency on the provider.
  'apps/api/package.json': 'the `svix` package verifies Resend webhooks',
  'apps/api/src/modules/webhooks/svix-request.ts': 'verifies Resend webhooks',
  'apps/api/src/modules/webhooks/resend.routes.ts': 'verifies Resend webhooks',
  'apps/api/src/modules/webhooks/resend.routes.test.ts': 'sends the `svix-*` headers',
  'apps/api/src/modules/webhooks/resend.schemas.ts': 'Resend signs the raw body',
  'apps/api/src/modules/users/users.dao.ts': 'comment on Resend redelivery',
  'apps/api/src/server.ts': 'redacts the `svix-signature` header from logs',
  'apps/api/src/server.test.ts': 'sends the `svix-*` headers',
  'apps/api/src/lib/email.ts': 'comment naming the Resend verifier seam',
  'apps/api/src/testing/test-server.ts': 'fakes the `svix-*` verifier',
  'apps/api/README.md': 'names the faked verifier',
  '.claude/rules/db-schema.md': 'names the faked verifier',
  'packages/shared/src/env/registry.ts': 'the Resend webhook secret is a svix signing secret',
  '.env.example': 'generated from that registry entry',
  'packages/shared/src/utils/error-reporting.ts': 'redacts the `svix-signature` header',
  'packages/shared/src/utils/error-reporting.test.ts': 'pins that redaction',
};

interface TrackedFile {
  path: string;
  text: string;
}

function isAllowed(path: string): boolean {
  return path in ALLOWED_FILES || ALLOWED_PREFIXES.some(([prefix]) => path.startsWith(prefix));
}

function matches(file: TrackedFile): string[] {
  const haystack = `${file.path}\n${file.text}`.toLowerCase();
  return NEEDLES.filter((needle) => haystack.includes(needle));
}

/** Every tracked file outside the allow-list that names a forbidden token. */
function violations(files: readonly TrackedFile[]): string[] {
  return files.filter((f) => !isAllowed(f.path) && matches(f).length > 0).map((f) => f.path);
}

function trackedFiles(): TrackedFile[] {
  const listed = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return listed
    .split('\0')
    .filter(Boolean)
    .map((path) => {
      try {
        return { path, text: readFileSync(resolve(ROOT, path), 'utf8') };
      } catch {
        // A tracked path deleted in the working tree; nothing to scan.
        return { path, text: '' };
      }
    });
}

describe('the repo names no retired provider', () => {
  const files = trackedFiles();

  it('scans the whole tree, so a clean result is not an empty one', () => {
    expect(files.length).toBeGreaterThan(500);
    expect(files.some((f) => f.path === 'apps/api/src/server.ts')).toBe(true);
  });

  it('finds nothing outside the allow-list', () => {
    expect(violations(files)).toEqual([]);
  });

  it('flags a forbidden token added under apps/', () => {
    const planted: TrackedFile = {
      path: 'apps/web/src/example.ts',
      text: `// ${['Cl', 'erk'].join('')} session\n`,
    };
    expect(violations([...files, planted])).toEqual(['apps/web/src/example.ts']);
  });

  it('flags a forbidden token in a file name', () => {
    const planted: TrackedFile = { path: `apps/api/src/${NEEDLES[0]}-webhook.ts`, text: '' };
    expect(violations([planted])).toEqual([planted.path]);
  });

  it('keeps every allow-listed file honest: it exists and still matches', () => {
    const byPath = new Map(files.map((f) => [f.path, f]));
    const stale = Object.keys(ALLOWED_FILES).filter((path) => {
      const file = byPath.get(path);
      return !file || matches(file).length === 0;
    });
    expect(stale).toEqual([]);
  });
});
