import { describe, expect, it } from 'vitest';
import {
  assertMinimumSize,
  backupKeys,
  compareRowCounts,
  dumpKeyFor,
  keysToPrune,
  latestManifestKey,
  parseManifest,
  resolveMinimumBytes,
  type BackupManifest,
} from './backup-plan.js';

const MANIFEST: BackupManifest = {
  version: 1,
  environment: 'staging',
  createdAt: '2026-09-14T03:00:12.000Z',
  dumpKey: 'db/staging/2026/09/14-030012.dump.age',
  dumpBytes: 812_331,
  encryptedBytes: 812_540,
  encryptedSha256: 'a'.repeat(64),
  serverVersion: '18.1',
  rowCounts: { 'public.users': 41, 'public.bookings': 17 },
};

describe('backupKeys', () => {
  it('files a dump and its manifest under the UTC date and time of the run', () => {
    // 23:30 in New York on the 13th is already the 14th in UTC.
    expect(backupKeys('production', new Date('2026-09-14T03:30:07.412Z'))).toEqual({
      dump: 'db/production/2026/09/14-033007.dump.age',
      manifest: 'db/production/2026/09/14-033007.manifest.json',
    });
  });

  it('gives a second run on the same day objects of its own, so it cannot overwrite the first', () => {
    const first = backupKeys('production', new Date('2026-09-14T03:00:00.000Z'));
    const second = backupKeys('production', new Date('2026-09-14T15:00:00.000Z'));

    expect(second.dump).not.toBe(first.dump);
    expect(second.manifest).not.toBe(first.manifest);
  });

  it('refuses an environment name that could escape its prefix', () => {
    expect(() => backupKeys('../production', new Date('2026-09-14T03:00:00.000Z'))).toThrow(
      /not a valid backup environment/,
    );
  });
});

describe('dumpKeyFor', () => {
  it('names the dump that sits beside a manifest', () => {
    expect(dumpKeyFor('db/staging/2026/09/14-030000.manifest.json')).toBe(
      'db/staging/2026/09/14-030000.dump.age',
    );
  });
});

describe('latestManifestKey', () => {
  const now = new Date('2026-09-14T12:00:00.000Z');

  it('picks the newest manifest of the environment asked for, ignoring the others', () => {
    const keys = [
      'db/staging/2026/08/31-030000.manifest.json',
      'db/staging/2026/09/02-030000.manifest.json',
      'db/staging/2026/09/02-150000.manifest.json',
      'db/staging/2026/09/02-150000.dump.age',
      'db/production/2026/09/03-030000.manifest.json',
      'db/staging-old/2026/09/10-030000.manifest.json',
    ];

    expect(latestManifestKey(keys, 'staging', now)).toBe(
      'db/staging/2026/09/02-150000.manifest.json',
    );
  });

  it('ignores a manifest dated in the future, which no run could have written', () => {
    const keys = [
      'db/production/2026/09/14-030000.manifest.json',
      'db/production/9999/12/31-000000.manifest.json',
    ];

    expect(latestManifestKey(keys, 'production', now)).toBe(
      'db/production/2026/09/14-030000.manifest.json',
    );
  });

  it('returns null when that environment has no backup yet', () => {
    expect(
      latestManifestKey(['db/production/2026/09/03-030000.manifest.json'], 'staging', now),
    ).toBeNull();
  });
});

describe('keysToPrune', () => {
  const now = new Date('2026-09-14T03:05:00.000Z');
  const pair = (stem: string): string[] => [
    `db/production/${stem}.dump.age`,
    `db/production/${stem}.manifest.json`,
  ];

  it('keeps thirty days — today back to 29 days ago — and prunes the 30th day back', () => {
    const keys = [
      ...pair('2026/09/14-030000'),
      ...pair('2026/08/16-030000'),
      ...pair('2026/08/15-030000'),
      // August's monthly copy, so the 15th is kept by nothing but its age.
      ...pair('2026/08/01-030000'),
    ];

    expect(keysToPrune(keys, 'production', now)).toEqual(pair('2026/08/15-030000'));
  });

  it('keeps the earliest backup of each of twelve months, and prunes the thirteenth', () => {
    const keys = [
      ...pair('2026/09/14-030000'),
      ...pair('2025/10/01-030000'),
      ...pair('2025/10/01-150000'),
      ...pair('2025/09/01-030000'),
    ];

    expect(keysToPrune(keys, 'production', now)).toEqual([
      ...pair('2025/09/01-030000'),
      ...pair('2025/10/01-150000'),
    ]);
  });

  it('keeps a month whose run on the 1st failed, through its earliest later backup', () => {
    const keys = [
      ...pair('2026/09/14-030000'),
      ...pair('2025/11/02-091500'),
      ...pair('2025/11/03-030000'),
    ];

    expect(keysToPrune(keys, 'production', now)).toEqual(pair('2025/11/03-030000'));
  });

  it('never touches another environment, a future-dated key, or a key it does not recognise', () => {
    const keys = [
      ...pair('2026/09/14-030000'),
      'db/staging/2020/01/02-030000.dump.age',
      'db/production/9999/01/01-030000.dump.age',
      'db/production/notes.txt',
    ];

    expect(keysToPrune(keys, 'production', now)).toEqual([]);
  });

  it('keeps the newest backup even when every one has aged out', () => {
    const keys = [...pair('2024/03/05-030000'), ...pair('2024/03/04-030000')];

    expect(keysToPrune(keys, 'production', now)).toEqual(pair('2024/03/04-030000'));
  });
});

describe('parseManifest', () => {
  it('round-trips a manifest it wrote', () => {
    expect(parseManifest(JSON.stringify(MANIFEST))).toEqual(MANIFEST);
  });

  it.each([
    ['not JSON', '{'],
    ['a wrong version', JSON.stringify({ ...MANIFEST, version: 2 })],
    ['a negative count', JSON.stringify({ ...MANIFEST, rowCounts: { 'public.users': -1 } })],
    ['a short digest', JSON.stringify({ ...MANIFEST, encryptedSha256: 'abc' })],
  ])('refuses %s', (_label, text) => {
    expect(() => parseManifest(text)).toThrow(/not a valid backup manifest/);
  });
});

describe('compareRowCounts', () => {
  it('reports nothing when every table matches', () => {
    expect(compareRowCounts({ 'public.users': 3 }, { 'public.users': 3 })).toEqual([]);
  });

  it('reports a changed count, a missing table and an unexpected one, in table order', () => {
    expect(
      compareRowCounts(
        { 'public.bookings': 5, 'public.users': 3 },
        { 'public.users': 2, 'public.zzz': 1 },
      ),
    ).toEqual([
      { table: 'public.bookings', expected: 5, actual: null },
      { table: 'public.users', expected: 3, actual: 2 },
      { table: 'public.zzz', expected: null, actual: 1 },
    ]);
  });
});

describe('the minimum dump size', () => {
  it('defaults when no override is given, and honours a positive override', () => {
    expect(resolveMinimumBytes(undefined)).toBe(65_536);
    expect(resolveMinimumBytes('')).toBe(65_536);
    expect(resolveMinimumBytes('1000000')).toBe(1_000_000);
  });

  it('refuses an override that is not a positive integer, rather than disabling the check', () => {
    expect(() => resolveMinimumBytes('0')).toThrow(/BACKUP_MIN_BYTES/);
    expect(() => resolveMinimumBytes('10kb')).toThrow(/BACKUP_MIN_BYTES/);
  });

  it('fails a dump below the floor, naming both sizes', () => {
    expect(() => assertMinimumSize(1_024, 65_536)).toThrow(
      'The dump is 1024 bytes, below the 65536-byte minimum. Refusing to store it as a backup.',
    );
    expect(() => assertMinimumSize(65_536, 65_536)).not.toThrow();
  });
});
