import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateX25519Identity, identityToRecipient } from 'age-encryption';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackupStore } from './backup-store.js';
import { runBackup } from './backup.js';
import { runRestoreDrill, type RestoreTarget } from './restore-drill.js';

const EMPTY_ROOT = mkdtempSync(path.join(tmpdir(), 'restore-drill-'));
const NOW = new Date('2026-09-14T03:00:00.000Z');
const ROW_COUNTS = { 'public.bookings': 17, 'public.users': 41 };
const DUMP = new Uint8Array(4_096).fill(7);

function memoryStore(): BackupStore & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    put: (key, body) => {
      objects.set(key, body);
      return Promise.resolve();
    },
    get: (key) => {
      const body = objects.get(key);
      return body ? Promise.resolve(body) : Promise.reject(new Error(`no ${key}`));
    },
    list: (prefix) => Promise.resolve([...objects.keys()].filter((key) => key.startsWith(prefix))),
    remove: (keys) => {
      for (const key of keys) objects.delete(key);
      return Promise.resolve();
    },
  };
}

interface FakeTarget extends RestoreTarget {
  created: string[];
  dropped: string[];
  restoredBytes: Uint8Array[];
}

function fakeTarget(counts: Record<string, number>): FakeTarget {
  const target: FakeTarget = {
    created: [],
    dropped: [],
    restoredBytes: [],
    create: (name) => {
      target.created.push(name);
      return Promise.resolve();
    },
    restore: (_name, dump) => {
      target.restoredBytes.push(dump);
      return Promise.resolve({ exitCode: 0, stderrTail: '' });
    },
    count: () => Promise.resolve(counts),
    drop: (name) => {
      target.dropped.push(name);
      return Promise.resolve();
    },
  };
  return target;
}

async function storeWithBackup(recipient: string): Promise<ReturnType<typeof memoryStore>> {
  const store = memoryStore();
  await runBackup({
    environment: 'staging',
    now: NOW,
    recipients: [recipient],
    minimumBytes: 1_024,
    store,
    takeDump: () => Promise.resolve({ dump: DUMP, rowCounts: ROW_COUNTS, serverVersion: '18.1' }),
    log: () => undefined,
  });
  return store;
}

describe('runBackup', () => {
  it('stores an encrypted dump and a manifest with the snapshot counts', async () => {
    const identity = await generateX25519Identity();
    const store = await storeWithBackup(await identityToRecipient(identity));

    expect([...store.objects.keys()].sort()).toEqual([
      'db/staging/2026/09/14-030000.dump.age',
      'db/staging/2026/09/14-030000.manifest.json',
    ]);
    const manifest = JSON.parse(
      new TextDecoder().decode(store.objects.get('db/staging/2026/09/14-030000.manifest.json')),
    ) as { rowCounts: unknown; dumpBytes: number };
    expect(manifest.rowCounts).toEqual(ROW_COUNTS);
    expect(manifest.dumpBytes).toBe(4_096);
    expect(store.objects.get('db/staging/2026/09/14-030000.dump.age')).not.toEqual(DUMP);
  });

  it('fails a dump below the minimum and writes nothing, so no good backup is pruned for it', async () => {
    const store = memoryStore();
    store.objects.set('db/staging/2026/08/01-030000.manifest.json', new Uint8Array([1]));

    await expect(
      runBackup({
        environment: 'staging',
        now: NOW,
        recipients: [await identityToRecipient(await generateX25519Identity())],
        minimumBytes: 65_536,
        store,
        takeDump: () =>
          Promise.resolve({ dump: DUMP, rowCounts: ROW_COUNTS, serverVersion: '18.1' }),
        log: () => undefined,
      }),
    ).rejects.toThrow('The dump is 4096 bytes, below the 65536-byte minimum.');
    expect([...store.objects.keys()]).toEqual(['db/staging/2026/08/01-030000.manifest.json']);
  });
});

describe('runRestoreDrill', () => {
  let identity: string;
  let store: ReturnType<typeof memoryStore>;

  beforeEach(async () => {
    identity = await generateX25519Identity();
    store = await storeWithBackup(await identityToRecipient(identity));
    vi.stubEnv('RESTORE_DATABASE_URL', 'postgresql://localhost:5432/vendor_marketplace');
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const drill = (target: RestoreTarget, overrides: { keep?: boolean; identity?: string } = {}) =>
    runRestoreDrill({
      environment: 'staging',
      identity: overrides.identity ?? identity,
      now: NOW,
      store,
      target,
      keep: overrides.keep ?? false,
      log: () => undefined,
      repoRoot: EMPTY_ROOT,
    });

  it('restores the decrypted dump into a fresh database, reports matching counts, and drops it', async () => {
    const target = fakeTarget(ROW_COUNTS);

    const report = await drill(target);

    expect(report.mismatches).toEqual([]);
    expect(report.restored).toEqual(ROW_COUNTS);
    expect(target.restoredBytes).toEqual([DUMP]);
    expect(target.created).toHaveLength(1);
    expect(target.created[0]).toMatch(/^restore_drill_\d+_[0-9a-f]{6}$/);
    expect(target.dropped).toEqual(target.created);
  });

  it('reports every table whose restored count differs from the manifest', async () => {
    const report = await drill(fakeTarget({ 'public.bookings': 16, 'public.users': 41 }));

    expect(report.mismatches).toEqual([{ table: 'public.bookings', expected: 17, actual: 16 }]);
  });

  it('keeps the restored database when asked', async () => {
    const target = fakeTarget(ROW_COUNTS);

    await drill(target, { keep: true });

    expect(target.dropped).toEqual([]);
  });

  it('refuses a production target before it downloads anything or creates a database', async () => {
    vi.stubEnv('RESTORE_DATABASE_URL', 'postgresql://owner@ep-x.us-east-2.aws.neon.tech/neondb');
    vi.stubEnv('RESTORE_NEON_BRANCH', 'production');
    vi.stubEnv('NODE_ENV', 'production');
    const list = vi.spyOn(store, 'list');
    const target = fakeTarget(ROW_COUNTS);

    await expect(drill(target)).rejects.toThrow(/Refusing to restore a backup/);
    expect(list).not.toHaveBeenCalled();
    expect(target.created).toEqual([]);
  });

  it('refuses a production-named Neon branch even outside NODE_ENV=production', async () => {
    vi.stubEnv('RESTORE_DATABASE_URL', 'postgresql://owner@ep-x.us-east-2.aws.neon.tech/neondb');
    vi.stubEnv('RESTORE_NEON_BRANCH', 'production');
    const target = fakeTarget(ROW_COUNTS);

    await expect(drill(target)).rejects.toThrow(
      'Refusing to restore a backup into the production branch (from RESTORE_NEON_BRANCH).',
    );
    expect(target.created).toEqual([]);
  });

  it('fails with the wrong key and creates nothing', async () => {
    const target = fakeTarget(ROW_COUNTS);

    await expect(drill(target, { identity: await generateX25519Identity() })).rejects.toThrow(
      /could not be decrypted/,
    );
    expect(target.created).toEqual([]);
  });

  it('refuses an object whose bytes no longer match the manifest digest', async () => {
    const key = 'db/staging/2026/09/14-030000.dump.age';
    const tampered = new Uint8Array(store.objects.get(key) ?? []);
    tampered.set([(tampered.at(-1) ?? 0) ^ 0xff], tampered.length - 1);
    store.objects.set(key, tampered);

    await expect(drill(fakeTarget(ROW_COUNTS))).rejects.toThrow(
      `${key} does not match its manifest's digest`,
    );
  });

  it.each([
    ['another dump', { dumpKey: 'db/staging/2026/01/01-030000.dump.age' }],
    ['another environment', { environment: 'production' }],
  ])('refuses a manifest that names %s', async (_label, change) => {
    const key = 'db/staging/2026/09/14-030000.manifest.json';
    const manifest = JSON.parse(new TextDecoder().decode(store.objects.get(key))) as object;
    store.objects.set(key, new TextEncoder().encode(JSON.stringify({ ...manifest, ...change })));
    const target = fakeTarget(ROW_COUNTS);

    await expect(drill(target)).rejects.toThrow(
      `${key} names a dump or environment other than its own. Refusing to restore it.`,
    );
    expect(target.created).toEqual([]);
  });

  it('drops the database even when counting fails', async () => {
    const target = fakeTarget(ROW_COUNTS);
    target.count = () => Promise.reject(new Error('connection lost'));

    await expect(drill(target)).rejects.toThrow('connection lost');
    expect(target.dropped).toEqual(target.created);
  });
});
