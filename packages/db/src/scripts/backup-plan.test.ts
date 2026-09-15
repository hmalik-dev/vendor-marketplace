import { describe, expect, it } from 'vitest';
import {
  assertMinimumSize,
  backupKeys,
  compareRowCounts,
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
  dumpKey: 'db/staging/2026/09/14.dump.age',
  dumpBytes: 812_331,
  encryptedBytes: 812_540,
  encryptedSha256: 'a'.repeat(64),
  serverVersion: '18.1',
  rowCounts: { 'public.users': 41, 'public.bookings': 17 },
};

describe('backupKeys', () => {
  it('files a dump and its manifest under the UTC date of the run', () => {
    // 23:30 in New York on the 13th is already the 14th in UTC.
    expect(backupKeys('production', new Date('2026-09-14T03:30:00.000Z'))).toEqual({
      dump: 'db/production/2026/09/14.dump.age',
      manifest: 'db/production/2026/09/14.manifest.json',
    });
  });

  it('refuses an environment name that could escape its prefix', () => {
    expect(() => backupKeys('../production', new Date('2026-09-14T03:00:00.000Z'))).toThrow(
      /not a valid backup environment/,
    );
  });
});

describe('latestManifestKey', () => {
  it('picks the newest manifest of the environment asked for, ignoring the others', () => {
    const keys = [
      'db/staging/2026/08/31.manifest.json',
      'db/staging/2026/09/02.manifest.json',
      'db/staging/2026/09/02.dump.age',
      'db/production/2026/09/03.manifest.json',
      'db/staging-old/2026/12/01.manifest.json',
    ];

    expect(latestManifestKey(keys, 'staging')).toBe('db/staging/2026/09/02.manifest.json');
  });

  it('returns null when that environment has no backup yet', () => {
    expect(latestManifestKey(['db/production/2026/09/03.manifest.json'], 'staging')).toBeNull();
  });
});

describe('keysToPrune', () => {
  const now = new Date('2026-09-14T03:05:00.000Z');
  const pair = (date: string): string[] => [
    `db/production/${date}.dump.age`,
    `db/production/${date}.manifest.json`,
  ];

  it('keeps thirty dailies — today back to 29 days ago — and prunes the 30th day back', () => {
    const keys = [...pair('2026/09/14'), ...pair('2026/08/16'), ...pair('2026/08/15')];

    expect(keysToPrune(keys, 'production', now)).toEqual(pair('2026/08/15'));
  });

  it('keeps the first of the month for twelve months, and prunes the thirteenth', () => {
    const keys = [
      ...pair('2026/09/14'),
      ...pair('2025/10/01'),
      ...pair('2025/09/01'),
      ...pair('2025/10/02'),
    ];

    expect(keysToPrune(keys, 'production', now)).toEqual([
      ...pair('2025/09/01'),
      ...pair('2025/10/02'),
    ]);
  });

  it('never touches another environment or a key it does not recognise', () => {
    const keys = ['db/staging/2020/01/02.dump.age', 'db/production/notes.txt'];

    expect(keysToPrune(keys, 'production', now)).toEqual([]);
  });

  it('keeps the newest backup even when every one has aged out', () => {
    const keys = [...pair('2024/03/05'), ...pair('2024/03/04')];

    expect(keysToPrune(keys, 'production', now)).toEqual(pair('2024/03/04'));
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
