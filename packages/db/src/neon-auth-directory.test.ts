import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNeonAuthDirectoryOver, type NeonAuthDirectory } from './neon-auth-directory.js';

const ADA = '0198c1f0-0000-7000-8000-00000000ada1';
const GRACE = '0198c1f0-0000-7000-8000-000000009ace';

describe('the Neon Auth directory', () => {
  let client: PGlite;
  let directory: NeonAuthDirectory;

  beforeAll(async () => {
    client = new PGlite();
    // The shape Neon Auth manages; the suite owns only the columns the directory reads.
    await client.exec(`
      create schema neon_auth;
      create table neon_auth."user" (id uuid primary key, name text not null, email text not null, image text);
      create table neon_auth.session (id text primary key, "userId" uuid not null references neon_auth."user"(id) on delete cascade);
      create table neon_auth.verification (id text primary key, identifier text not null, value text not null);
    `);
    directory = createNeonAuthDirectoryOver(async (query, params) => {
      const result = await client.query<Record<string, unknown>>(query, params);
      return result.rows;
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it('looks up only the identities that exist, and reads them as the mirror needs them', async () => {
    await client.query(
      `insert into neon_auth."user" values ($1, 'Ada Lovelace', 'ada@example.test', null)`,
      [ADA],
    );

    const found = await directory.lookup([ADA, GRACE]);

    expect(found).toEqual([
      { id: ADA, email: 'ada@example.test', name: 'Ada Lovelace', image: null },
    ]);
    expect(await directory.lookup([])).toEqual([]);
  });

  it('deletes the identity, its sessions and its leftover one-time codes, and only those', async () => {
    await client.query(
      `insert into neon_auth."user" values ($1, 'Grace Hopper', 'grace@example.test', 'https://img.test/g.png')`,
      [GRACE],
    );
    await client.query(`insert into neon_auth.session values ('s1', $1)`, [GRACE]);
    await client.query(
      `insert into neon_auth.verification values ('v1', 'email-verification-otp-grace@example.test', 'x'), ('v2', 'email-verification-otp-ada@example.test', 'y'), ('v3', 'email-verification-otp-xgrace@example.test', 'z')`,
    );

    expect(await directory.deleteIdentity(GRACE)).toBe(true);

    expect(await directory.lookup([GRACE])).toEqual([]);
    expect((await client.query('select id from neon_auth.session')).rows).toEqual([]);
    expect((await client.query('select id from neon_auth.verification')).rows).toEqual([
      { id: 'v2' },
      { id: 'v3' },
    ]);
    expect((await directory.lookup([ADA])).map((identity) => identity.id)).toEqual([ADA]);
  });

  it('says so when there was no such identity to delete', async () => {
    await expect(directory.deleteIdentity(GRACE)).resolves.toBe(false);
  });
});
