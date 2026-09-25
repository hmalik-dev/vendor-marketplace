import { describe, expect, it } from 'vitest';
import {
  assertEveryTableClassified,
  assertTierMatchesHost,
  deletionOrder,
  KEPT_TABLES,
  parseResetArgs,
  PARTIAL_TABLES,
  redact,
  ResetRefusal,
  schemaTables,
  TIER_ENDPOINTS,
  WIPED_TABLES,
} from './reset.js';

/** Built, not written out, so no connection string with a password sits in the source. */
function connectionString(host: string, password: string, database = 'neondb'): string {
  const url = new URL(`postgresql://${host}/${database}`);
  url.username = 'owner';
  url.password = password;
  return url.toString();
}

const STAGING_URL = connectionString(
  `${TIER_ENDPOINTS.staging}.us-east-2.aws.neon.tech`,
  'fake-staging-pw',
);
const PRODUCTION_URL = connectionString(
  `${TIER_ENDPOINTS.production}-pooler.us-east-2.aws.neon.tech`,
  'fake-production-pw',
);
const LOCAL_URL = connectionString(
  'localhost:5432',
  'fake-local-pw',
  'vendor_marketplace_lane_ven_751',
);

describe('parseResetArgs', () => {
  it('reads every flag', () => {
    expect(parseResetArgs(['--tier', 'staging', '--confirm', 'neondb', '--yes', '--auth'])).toEqual(
      { tier: 'staging', confirm: 'neondb', yes: true, dryRun: false, auth: true },
    );
    expect(parseResetArgs(['--tier', 'local', '--confirm', 'db', '--dry-run'])).toEqual({
      tier: 'local',
      confirm: 'db',
      yes: false,
      dryRun: true,
      auth: false,
    });
  });

  it.each([
    ['no --tier', ['--confirm', 'db', '--yes'], /--tier must be one of local, staging, production/],
    ['an unknown tier', ['--tier', 'prod', '--confirm', 'db'], /--tier must be one of/],
    ['no --confirm', ['--tier', 'local', '--yes'], /--confirm must name the database/],
    ['--confirm with no value', ['--tier', 'local', '--confirm'], /--confirm must name/],
    [
      'an unknown flag',
      ['--tier', 'local', '--confirm', 'db', '--force'],
      /Unknown argument "--force"/,
    ],
    [
      '--auth on local',
      ['--tier', 'local', '--confirm', 'db', '--auth'],
      /--auth is for staging and production/,
    ],
  ])('refuses %s', (_case, argv, message) => {
    expect(() => parseResetArgs(argv)).toThrow(message);
    expect(() => parseResetArgs(argv)).toThrow(ResetRefusal);
  });
});

describe('assertTierMatchesHost', () => {
  it('accepts each tier on its own host, pooled or direct', () => {
    expect(() => assertTierMatchesHost('local', LOCAL_URL)).not.toThrow();
    expect(() => assertTierMatchesHost('staging', STAGING_URL)).not.toThrow();
    expect(() => assertTierMatchesHost('production', PRODUCTION_URL)).not.toThrow();
  });

  it.each([
    ['production', STAGING_URL, /--tier production needs the ep-lucky-cherry-axtyizs9 endpoint/],
    ['staging', PRODUCTION_URL, /--tier staging needs the ep-jolly-poetry-ax8noqyz endpoint/],
    ['local', STAGING_URL, /--tier local needs a local database/],
    ['staging', LOCAL_URL, /--tier staging needs/],
    [
      'production',
      connectionString(`${TIER_ENDPOINTS.production}.example.com`, 'fake-pw'),
      /--tier production needs/,
    ],
  ] as const)('refuses --tier %s against another host', (tier, url, message) => {
    expect(() => assertTierMatchesHost(tier, url)).toThrow(message);
  });

  it('names the host in a refusal but never the password', () => {
    let message = '';
    try {
      assertTierMatchesHost('production', STAGING_URL);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(`${TIER_ENDPOINTS.staging}.us-east-2.aws.neon.tech`);
    expect(message).not.toContain('fake-staging-pw');
  });
});

describe('the table classification', () => {
  const names = schemaTables().map((table) => table.name);

  it('covers every schema table exactly once', () => {
    expect(() => assertEveryTableClassified(names)).not.toThrow();
    expect(
      Object.keys(KEPT_TABLES).length + Object.keys(PARTIAL_TABLES).length + WIPED_TABLES.length,
    ).toBe(names.length);
  });

  it('refuses a table on no list, and a listed table that is gone', () => {
    expect(() => assertEveryTableClassified([...names, 'payout_ledger'])).toThrow(
      /not classified as kept, partial or wiped: payout_ledger/,
    );
    expect(() => assertEveryTableClassified(names.filter((name) => name !== 'reviews'))).toThrow(
      /listed but not in the schema: reviews/,
    );
  });

  it('keeps reference data, settings, the send-day quota and admins, and wipes the rest', () => {
    expect(Object.keys(KEPT_TABLES).sort()).toEqual([
      'categories',
      'email_send_days',
      'platform_settings',
      'tags',
      'us_cities',
    ]);
    expect(Object.keys(PARTIAL_TABLES).sort()).toEqual(['legal_acceptances', 'users']);
    expect(PARTIAL_TABLES.users).toBe(`role = 'admin'`);
  });
});

describe('deletionOrder', () => {
  it('deletes every table before any table it references', () => {
    const tables = schemaTables();
    const order = deletionOrder(tables);

    expect(order.length).toBe(WIPED_TABLES.length + Object.keys(PARTIAL_TABLES).length);
    for (const table of tables) {
      for (const parent of table.parents) {
        if (order.includes(parent) && parent !== table.name) {
          expect(order.indexOf(table.name), `${table.name} before ${parent}`).toBeLessThan(
            order.indexOf(parent),
          );
        }
      }
    }
    expect(order.at(-1)).toBe('users');
  });

  it('refuses a foreign-key cycle rather than guessing', () => {
    expect(() =>
      deletionOrder([
        { name: 'users', parents: ['reviews'] },
        { name: 'reviews', parents: ['users'] },
      ]),
    ).toThrow(/Foreign keys form a cycle among users, reviews/);
  });
});

describe('redact', () => {
  it('removes the connection string and its password', () => {
    expect(redact(`failed on ${LOCAL_URL} with fake-local-pw`, LOCAL_URL)).toBe(
      'failed on <connection string> with <password>',
    );
  });
});
