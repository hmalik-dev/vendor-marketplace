import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { pgEnvironment, planPgCommand } from './backup-database.js';

/** Minted per run and set on the URL object, so no credential is written here. */
const fakeCredential = `x@${randomUUID()}`;

function urlWithCredential(base: string): URL {
  const url = new URL(base);
  url.username = 'owner';
  url.password = encodeURIComponent(fakeCredential);
  return url;
}

const NEON = urlWithCredential('postgresql://ep-x.us-east-2.aws.neon.tech/neondb?sslmode=require');
const LOCAL = urlWithCredential('postgresql://localhost:55432/lane_db');

describe('pgEnvironment', () => {
  it('hands libpq decoded parts, including the SSL mode Neon needs', () => {
    expect(Object.entries(pgEnvironment(NEON))).toEqual([
      ['PGHOST', 'ep-x.us-east-2.aws.neon.tech'],
      ['PGPORT', '5432'],
      ['PGUSER', 'owner'],
      ['PGPASSWORD', fakeCredential],
      ['PGDATABASE', 'neondb'],
      ['PGSSLMODE', 'require'],
    ]);
  });
});

/*
 * AC: no credential or connection string in the workflow's logs. The argv is
 * what a process list or an echoed command shows, so it carries neither.
 */
describe('planPgCommand', () => {
  it('runs the installed tool with the credential in the environment only', () => {
    const plan = planPgCommand('pg_dump', ['--format=custom'], NEON, {
      nativeAvailable: true,
      container: 'pg',
    });

    expect(plan.command).toBe('pg_dump');
    expect(plan.args).toEqual(['--format=custom']);
    expect(plan.env.PGHOST).toBe('ep-x.us-east-2.aws.neon.tech');
  });

  it('borrows the tool from the compose container for a local server, on its internal port', () => {
    const plan = planPgCommand('pg_restore', ['--no-owner'], LOCAL, {
      nativeAvailable: false,
      container: 'vendor-marketplace-postgres',
    });

    expect(plan.command).toBe('docker');
    expect(plan.args).toEqual([
      'exec',
      '-i',
      '-e',
      'PGHOST',
      '-e',
      'PGPORT',
      '-e',
      'PGUSER',
      '-e',
      'PGPASSWORD',
      '-e',
      'PGDATABASE',
      'vendor-marketplace-postgres',
      'pg_restore',
      '--no-owner',
    ]);
    expect([plan.env.PGHOST, plan.env.PGPORT, plan.env.PGDATABASE]).toEqual([
      'localhost',
      '5432',
      'lane_db',
    ]);
  });

  it.each([NEON, LOCAL])('never puts the credential or a connection string in argv', (url) => {
    const argv = planPgCommand('pg_dump', ['--format=custom'], url, {
      nativeAvailable: url === NEON,
      container: 'pg',
    }).args.join(' ');

    expect(argv).not.toContain(fakeCredential);
    expect(argv).not.toContain('postgresql://');
  });

  it('refuses the container fallback for a remote server', () => {
    expect(() =>
      planPgCommand('pg_dump', [], NEON, { nativeAvailable: false, container: 'pg' }),
    ).toThrow(/Install the Postgres 18 client/);
  });
});
