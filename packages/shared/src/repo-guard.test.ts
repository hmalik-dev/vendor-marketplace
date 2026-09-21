import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * VEN-449, VEN-458: the repo describes the system that exists. The identity
 * provider was replaced by Neon Auth and object storage by Neon Object Storage
 * (VEN-455), so none of their old names may come back. The needles are built
 * from fragments so this file does not match its own scan, and every exception
 * below names the reason it exists.
 */
const IDP = new RegExp(['cl', 'erk'].join(''));

const NEEDLES: readonly RegExp[] = [
  new RegExp(['sv', 'ix'].join('')),
  new RegExp(['cloudflare', ' ', 'r', '2'].join('')),
  new RegExp(['mi', 'nio'].join('')),
  new RegExp(String.raw`\b${['r', '2'].join('')}\b`),
];

const ROOT = resolve(import.meta.dirname, '../../..');

/**
 * The identity provider's name (VEN-503) is allowed only where history cannot
 * change: applied migrations and the tests that replay schemas older than the
 * `auth_user_id` rename. Nothing else, not agent notes or design copies, may
 * name it; a design re-import is a merge and can bring it back, which this fails.
 */
const IDP_ALLOWED_PREFIXES: readonly string[] = ['packages/db/drizzle/'];
const IDP_ALLOWED_FILES: Readonly<Record<string, string>> = {
  'packages/db/src/auth-provider-migration.test.ts':
    'runs migrations 0055 and 0056, which backfill the removed enum value',
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
};

/** Trees left as they were written; a match anywhere under one is fine. */
const ALLOWED_PREFIXES: readonly (readonly [prefix: string, reason: string])[] = [
  ['design/uploads/', 'imported design bundles; design re-imports are merges'],
  ['packages/db/drizzle/', 'generated migrations and snapshots; history is never hand-edited'],
  ['.claude/agent-memory/', 'dated reviewer notes, a record of what was true when written'],
  ['.claude/memory/', 'dated project notes, a record of what was true when written'],
  ['design/delta-legal/', 'imported legal design bundle; design re-imports are merges'],
];

/** Individual files, each with the reason its match is legitimate. */
const ALLOWED_FILES: Readonly<Record<string, string>> = {
  '.claude/plans/vendor-marketplace-decisions.md': 'the decisions log keeps its history',
  '.claude/plans/vendor-marketplace-plan.md':
    'the original architecture plan, marked superseded at its head',
  'design/Orla-Screens-all.html': 'compiled design export, left as imported',
  'packages/preflight/src/launch/config.ts':
    'launch:check fails an object-storage host left on the retired provider',
  'packages/preflight/src/launch/launch.test.ts': 'pins that failure',
  'packages/shared/src/utils/index.ts':
    'repoints image URLs stored under the retired provider to the configured base',
  'packages/shared/src/utils/image-url.test.ts': 'pins that repointing',
  'packages/db/src/scripts/keys-from-urls.test.ts': 'normalises retired-provider URLs to keys',
  'pnpm-lock.yaml': 'the resolved graph of the webhook-signature package Resend uses',
  'packages/preflight/src/secrets/patterns.ts':
    'the secret scanner keeps a signing-secret rule for the Resend webhook verifier',
  'packages/preflight/src/secrets/scan.test.ts': 'pins that rule',
  // Resend signs its webhooks with its own signing protocol: the signature headers and
  // the signature package are its wire contract, not a dependency on the provider.
  'apps/api/package.json': 'the signature package verifies Resend webhooks',
  [`apps/api/src/modules/webhooks/${['sv', 'ix'].join('')}-request.ts`]: 'verifies Resend webhooks',
  'apps/api/src/modules/webhooks/resend.routes.ts': 'verifies Resend webhooks',
  'apps/api/src/modules/webhooks/resend.routes.test.ts': 'sends the webhook signature headers',
  'apps/api/src/modules/webhooks/resend.schemas.ts': 'Resend signs the raw body',
  'apps/api/src/modules/users/users.dao.ts': 'comment on Resend redelivery',
  'apps/api/src/server.ts': 'redacts the webhook signature header from logs',
  'apps/api/src/server.test.ts': 'sends the webhook signature headers',
  'apps/api/src/testing/test-server.ts': 'fakes the webhook signature verifier',
  '.claude/rules/db-schema.md': 'names the faked verifier',
  'packages/shared/src/env/registry.ts': 'the Resend webhook secret is a signing secret',
  '.env.example': 'generated from that registry entry',
  'packages/shared/src/utils/error-reporting.ts': 'redacts the webhook signature header',
  'packages/shared/src/utils/error-reporting.test.ts': 'pins that redaction',
};

interface TrackedFile {
  path: string;
  text: string;
}

function isAllowed(path: string): boolean {
  return path in ALLOWED_FILES || ALLOWED_PREFIXES.some(([prefix]) => path.startsWith(prefix));
}

function isIdpAllowed(path: string): boolean {
  return path in IDP_ALLOWED_FILES || IDP_ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

function haystackOf(file: TrackedFile): string {
  return `${file.path}\n${file.text}`.toLowerCase();
}

function matches(file: TrackedFile): RegExp[] {
  const haystack = haystackOf(file);
  return NEEDLES.filter((needle) => needle.test(haystack));
}

/** Every tracked file outside its allow-list that names a forbidden token. */
function violations(files: readonly TrackedFile[]): string[] {
  return files
    .filter(
      (f) =>
        (!isAllowed(f.path) && matches(f).length > 0) ||
        (!isIdpAllowed(f.path) && IDP.test(haystackOf(f))),
    )
    .map((f) => f.path);
}

/**
 * Package names in a pnpm lockfile that contain the retired provider's name,
 * in both `packages:` keys (`'@scope/name@1.0.0':`) and importer entries.
 */
function lockfilePackagesNaming(lock: string, needle: RegExp): string[] {
  const names = [...lock.matchAll(/^\s+'?((?:@[^/'\s]+\/)?[^@'\s:]+)(?:@[^':\s]*)?'?:/gm)];
  return names.map((m) => m[1]!).filter((name) => needle.test(name.toLowerCase()));
}

function trackedFiles(): TrackedFile[] {
  const listed = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return listed
    .split('\0')
    .filter(Boolean)
    .map((path) => {
      try {
        const bytes = readFileSync(resolve(ROOT, path));
        // Binary files (images) hold arbitrary bytes; only text can name a provider.
        return { path, text: bytes.includes(0) ? '' : bytes.toString('utf8') };
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

  it('flags the retired object-storage names under apps/ and docs/', () => {
    const local: TrackedFile = {
      path: 'apps/api/src/example.ts',
      text: `// ${['Mi', 'nIO'].join('')} bucket\n`,
    };
    const bucket: TrackedFile = {
      path: 'docs/example.md',
      text: `${['Cloudflare', ' ', 'R', '2'].join('')} bucket\n`,
    };
    const bare: TrackedFile = { path: 'docs/bare.md', text: `${['R', '2'].join('')} outage\n` };
    const clean: TrackedFile = { path: 'docs/clean.md', text: 'a r25 bucket, an hr2x\n' };
    expect(violations([local, bucket, bare, clean])).toEqual([local.path, bucket.path, bare.path]);
  });

  it('flags the provider name in any case, in a scratch doc or agent note', () => {
    const shout: TrackedFile = { path: 'docs/notes.md', text: `${['CL', 'ERK'].join('')} keys\n` };
    const note: TrackedFile = {
      path: '.claude/agent-memory/x/note.md',
      text: `the ${['Cl', 'erk'].join('')} webhook\n`,
    };
    const design: TrackedFile = {
      path: 'design/uploads/plan.md',
      text: `${['Cl', 'erk'].join('')} for identity\n`,
    };
    expect(violations([shout, note, design])).toEqual([shout.path, note.path, design.path]);
  });

  it('lets applied migrations and the pre-0048 migration tests keep the name', () => {
    const text = `${['cl', 'erk'].join('')}_user_id`;
    const applied: TrackedFile = { path: 'packages/db/drizzle/0001_x.sql', text };
    const replay: TrackedFile = { path: 'packages/db/src/drop-style-tags.test.ts', text };
    expect(violations([applied, replay])).toEqual([]);
  });

  it('flags a package in the lockfile whose name contains the provider name', () => {
    const scoped = `packages:\n\n  '@${['cl', 'erk'].join('')}/nextjs@6.0.0':\n    resolution: {}\n`;
    const bare = `snapshots:\n  ${['cl', 'erk'].join('')}-sdk@1.2.3:\n    dependencies: {}\n`;
    const importer = `      '@${['cl', 'erk'].join('')}/backend':\n        specifier: ^1.0.0\n`;
    const clean = `packages:\n  '${['sv', 'ix'].join('')}@2.1.0':\n    resolution: {}\n  next@15.0.0:\n`;

    expect(lockfilePackagesNaming(scoped, IDP)).toEqual([`@${['cl', 'erk'].join('')}/nextjs`]);
    expect(lockfilePackagesNaming(bare, IDP)).toEqual([`${['cl', 'erk'].join('')}-sdk`]);
    expect(lockfilePackagesNaming(importer, IDP)).toEqual([`@${['cl', 'erk'].join('')}/backend`]);
    expect(lockfilePackagesNaming(clean, IDP)).toEqual([]);
  });

  it('finds no such package in the real lockfile, which is not empty', () => {
    const lock = files.find((f) => f.path === 'pnpm-lock.yaml')?.text ?? '';
    expect(lock.length).toBeGreaterThan(1000);
    expect(lockfilePackagesNaming(lock, new RegExp(['sv', 'ix'].join('')))).not.toEqual([]);
    expect(lockfilePackagesNaming(lock, IDP)).toEqual([]);
  });

  it('flags a forbidden token in a file name', () => {
    const planted: TrackedFile = {
      path: `apps/api/src/${['cl', 'erk'].join('')}-webhook.ts`,
      text: '',
    };
    expect(violations([planted])).toEqual([planted.path]);
  });

  it('keeps every allow-listed file honest: it exists and still matches', () => {
    const byPath = new Map(files.map((f) => [f.path, f]));
    const stale = Object.keys(ALLOWED_FILES).filter((path) => {
      const file = byPath.get(path);
      return !file || matches(file).length === 0;
    });
    const staleIdp = Object.keys(IDP_ALLOWED_FILES).filter((path) => {
      const file = byPath.get(path);
      return !file || !IDP.test(haystackOf(file));
    });
    expect(stale).toEqual([]);
    expect(staleIdp).toEqual([]);
  });
});
