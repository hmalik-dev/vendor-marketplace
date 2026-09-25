import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import { MIGRATION_SESSION_SETTINGS } from '../migration-session.js';
import { resolveMigrationUrl } from '../migration-url.js';
import * as schema from '../schema/index.js';

/**
 *   pnpm db:reset --tier <local|staging|production> --confirm <database> [--dry-run | --yes] [--auth]
 *
 * Empties an environment's application data and keeps what the next release
 * needs (VEN-751): the migrations table, the reference data, the platform
 * settings and every admin with the consent rows that keep it valid. It runs
 * as the migration role over `DATABASE_URL_UNPOOLED`, in one transaction, and
 * never prints the connection string.
 */

export const RESET_TIERS = ['local', 'staging', 'production'] as const;
export type ResetTier = (typeof RESET_TIERS)[number];

/** The Neon endpoint each deployed tier's database lives on; the host must name it. */
export const TIER_ENDPOINTS: Record<Exclude<ResetTier, 'local'>, string> = {
  staging: 'ep-jolly-poetry-ax8noqyz',
  production: 'ep-lucky-cherry-axtyizs9',
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Tables whose rows all survive, and why. */
export const KEPT_TABLES: Readonly<Record<string, string>> = {
  categories: 'reference seed',
  tags: 'reference seed',
  us_cities: 'reference seed',
  platform_settings: 'singleton configuration',
  email_send_days: "mirrors Resend's daily quota, which a reset does not clear",
};

/** Tables that keep the rows matching a predicate and lose the rest. */
export const PARTIAL_TABLES: Readonly<Record<string, string>> = {
  users: `role = 'admin'`,
  legal_acceptances: `vendor_id IS NULL AND accepted_by_user_id IN (SELECT id FROM users WHERE role = 'admin')`,
};

/** Every other application table: all rows go. */
export const WIPED_TABLES: readonly string[] = [
  'admin_actions',
  'admin_alerts',
  'availability',
  'booking_events',
  'booking_requests',
  'bookings',
  'conversations',
  'email_deliveries',
  'messages',
  'notifications',
  'portfolio_items',
  'rate_limit_counters',
  'realtime_events',
  'refund_attempts',
  'review_tombstones',
  'reviews',
  'service_packages',
  'sign_up_roles',
  'step_up_challenges',
  'step_up_grants',
  'stream_tickets',
  'stripe_webhook_failures',
  'support_cases',
  'tag_suggestions',
  'throttle_hits',
  'vendor_applications',
  'vendor_categories',
  'vendor_invites',
  'vendor_profiles',
  'vendor_slug_aliases',
  'vendor_tags',
];

/**
 * The append-only guards a reset has to step past. `booking_events` refuses
 * every delete; the other two refuse one while the actor still exists, and the
 * actor cannot go first because their foreign keys restrict. Disabled inside
 * the transaction and enabled again before it commits, so no other session
 * ever sees them off.
 */
export const APPEND_ONLY_DELETE_TRIGGERS: Readonly<Record<string, string>> = {
  booking_events: 'booking_events_no_delete',
  admin_actions: 'admin_actions_no_delete',
  legal_acceptances: 'legal_acceptances_no_delete',
};

export class ResetRefusal extends Error {
  override name = 'ResetRefusal';
}

export interface ResetArgs {
  tier: ResetTier;
  confirm: string;
  yes: boolean;
  dryRun: boolean;
  auth: boolean;
}

const USAGE =
  'Usage: pnpm db:reset --tier <local|staging|production> --confirm <database> [--dry-run | --yes] [--auth]';

export function parseResetArgs(argv: readonly string[]): ResetArgs {
  let tier: string | undefined;
  let confirm: string | undefined;
  let yes = false;
  let dryRun = false;
  let auth = false;

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case '--tier':
        tier = argv[(index += 1)];
        break;
      case '--confirm':
        confirm = argv[(index += 1)];
        break;
      case '--yes':
        yes = true;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--auth':
        auth = true;
        break;
      case '--':
        break;
      default:
        throw new ResetRefusal(`Unknown argument ${JSON.stringify(flag)}. ${USAGE}`);
    }
  }

  if (!tier || !(RESET_TIERS as readonly string[]).includes(tier)) {
    throw new ResetRefusal(`--tier must be one of ${RESET_TIERS.join(', ')}. ${USAGE}`);
  }
  if (!confirm) {
    throw new ResetRefusal(`--confirm must name the database being reset. ${USAGE}`);
  }
  if (auth && tier === 'local') {
    throw new ResetRefusal(
      '--auth is for staging and production: local identities live on the shared Neon dev branch.',
    );
  }

  return { tier: tier as ResetTier, confirm, yes, dryRun, auth };
}

export interface CheckedHost {
  host: string;
  port: number;
}

/**
 * Refuses a connection whose host is not the tier's own, and returns the host
 * it checked so the driver dials exactly that one. postgres.js reads a
 * comma-separated host list after the first `@`, where `URL` reads one host
 * after the last, so a string the two could disagree about is refused.
 * Never echoes the URL.
 */
export function assertTierMatchesHost(tier: ResetTier, connectionString: string): CheckedHost {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new ResetRefusal('The database connection string is not parseable.');
  }
  const authority = connectionString.split('://')[1]?.split('/')[0] ?? '';
  if (authority.split('@').length > 2 || /[,%]/.test(url.host)) {
    throw new ResetRefusal('The database connection string must name exactly one host.');
  }
  const host = url.hostname.toLowerCase();
  const checked = { host, port: Number(url.port) || 5432 };

  if (tier === 'local') {
    if (!LOCAL_HOSTS.has(host)) {
      throw new ResetRefusal(`--tier local needs a local database; the connection is to ${host}.`);
    }
    return checked;
  }

  const endpoint = host.endsWith('.neon.tech')
    ? host.split('.')[0]!.replace(/-pooler$/, '')
    : undefined;
  if (endpoint !== TIER_ENDPOINTS[tier]) {
    throw new ResetRefusal(
      `--tier ${tier} needs the ${TIER_ENDPOINTS[tier]} endpoint; the connection is to ${host}.`,
    );
  }
  return checked;
}

export interface SchemaTable {
  name: string;
  /** Tables this one holds a foreign key to. */
  parents: string[];
}

export function schemaTables(): SchemaTable[] {
  return (Object.values(schema) as unknown[])
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => {
      const config = getTableConfig(table);
      return {
        name: config.name,
        parents: config.foreignKeys.map((fk) => getTableConfig(fk.reference().foreignTable).name),
      };
    });
}

/** Every table sits in exactly one of the three lists, and every listed table exists. */
export function assertEveryTableClassified(tables: readonly string[]): void {
  const lists = [Object.keys(KEPT_TABLES), Object.keys(PARTIAL_TABLES), WIPED_TABLES];
  const listed = lists.flat();
  const unclassified = tables.filter((name) => !listed.includes(name));
  const twice = listed.filter((name, index) => listed.indexOf(name) !== index);
  const unknown = listed.filter((name) => !tables.includes(name));

  const problems = [
    unclassified.length > 0 &&
      `not classified as kept, partial or wiped: ${unclassified.join(', ')}`,
    twice.length > 0 && `classified twice: ${twice.join(', ')}`,
    unknown.length > 0 && `listed but not in the schema: ${unknown.join(', ')}`,
  ].filter(Boolean);

  if (problems.length > 0) {
    throw new ResetRefusal(`The reset lists disagree with the schema; ${problems.join('; ')}.`);
  }
}

/** The tables to delete from, each before any table it references. */
export function deletionOrder(tables: readonly SchemaTable[]): string[] {
  const targets = new Set([...Object.keys(PARTIAL_TABLES), ...WIPED_TABLES]);
  const pending = tables.filter((table) => targets.has(table.name));
  const order: string[] = [];

  while (pending.length > 0) {
    const referenced = new Set(
      pending.flatMap((table) => table.parents.filter((parent) => parent !== table.name)),
    );
    const ready = pending
      .filter((table) => !referenced.has(table.name))
      .map((table) => table.name)
      .sort();
    if (ready.length === 0) {
      throw new ResetRefusal(
        `Foreign keys form a cycle among ${pending.map((table) => table.name).join(', ')}.`,
      );
    }
    order.push(...ready);
    for (const name of ready) {
      pending.splice(
        pending.findIndex((table) => table.name === name),
        1,
      );
    }
  }

  return order;
}

export interface PlanRow {
  table: string;
  total: number;
  keep: number;
  delete: number;
}

export interface ResetOptions {
  confirm: string;
  yes: boolean;
  dryRun: boolean;
  auth: boolean;
  log: (line: string) => void;
  /** Runs before each table's delete; the suite uses it to fail mid-run. */
  beforeTable?: (table: string, index: number) => Promise<void> | void;
}

export interface ResetResult {
  plan: PlanRow[];
  deleted: boolean;
}

const NEON_AUTH_USERS = 'neon_auth."user"';
const NEON_AUTH_CODES = 'neon_auth.verification';
const ADMIN_AUTH_IDS = `SELECT auth_user_id FROM public.users WHERE role = 'admin'`;

/**
 * What `--auth` keeps of the identity store: the admins' identities, and the
 * one-time codes addressed to them (the whole address, or a `<flow>-` prefix
 * on it, as `neon-auth-directory.ts` matches them). Every other code names a
 * person the reset removed.
 */
const NEON_AUTH_KEEP: Readonly<Record<string, string>> = {
  [NEON_AUTH_USERS]: `id::text IN (${ADMIN_AUTH_IDS})`,
  [NEON_AUTH_CODES]: `EXISTS (SELECT 1 FROM neon_auth."user" kept
     WHERE kept.id::text IN (${ADMIN_AUTH_IDS})
       AND (lower(identifier) = lower(kept.email)
         OR right(lower(identifier), length(kept.email) + 1) = '-' || lower(kept.email)))`,
};

function keepPredicate(table: string): string {
  if (table in KEPT_TABLES) {
    return 'true';
  }
  return PARTIAL_TABLES[table] ?? NEON_AUTH_KEEP[table] ?? 'false';
}

function quoted(table: string): string {
  return table in NEON_AUTH_KEEP ? table : `"${table}"`;
}

async function countRows(tx: postgres.TransactionSql, table: string): Promise<PlanRow> {
  const from = quoted(table);
  const keep = keepPredicate(table);
  const [row] = await tx.unsafe<{ total: string; keep: string }[]>(
    `SELECT count(*) AS total, count(*) FILTER (WHERE coalesce((${keep}), false)) AS keep FROM ${from}`,
  );
  const total = Number(row!.total);
  const kept = Number(row!.keep);
  return { table, total, keep: kept, delete: total - kept };
}

function formatPlan(plan: readonly PlanRow[]): string[] {
  const width = Math.max(...plan.map((row) => row.table.length));
  const rows = [...plan].sort((a, b) => a.table.localeCompare(b.table));
  return [
    `${'table'.padEnd(width)}  ${'delete'.padStart(8)}  ${'keep'.padStart(8)}`,
    ...rows.map(
      (row) =>
        `${row.table.padEnd(width)}  ${String(row.delete).padStart(8)}  ${String(row.keep).padStart(8)}`,
    ),
    `${'total'.padEnd(width)}  ${String(plan.reduce((sum, row) => sum + row.delete, 0)).padStart(8)}  ${String(plan.reduce((sum, row) => sum + row.keep, 0)).padStart(8)}`,
  ];
}

/**
 * Plans, prints and (with `yes`) performs the reset in one transaction: a
 * refusal or a failure anywhere leaves every row where it was.
 */
export async function resetDatabase(
  sql: postgres.Sql,
  options: ResetOptions,
): Promise<ResetResult> {
  try {
    return await sql.begin((tx) => resetInTransaction(tx, options));
  } catch (error) {
    if (error instanceof DryRunRollback) {
      return { plan: error.plan, deleted: false };
    }
    throw error;
  }
}

/** Thrown to roll a dry run back, since it lifts the same guards the real run does. */
class DryRunRollback extends Error {
  constructor(readonly plan: PlanRow[]) {
    super('dry run');
  }
}

async function resetInTransaction(
  tx: postgres.TransactionSql,
  options: ResetOptions,
): Promise<ResetResult> {
  const [{ database } = { database: '' }] = await tx.unsafe<{ database: string }[]>(
    'SELECT current_database() AS database',
  );
  if (options.confirm !== database) {
    throw new ResetRefusal(
      `--confirm does not match the connected database; type its name (${database}) to go on.`,
    );
  }

  const tables = schemaTables();
  const names = tables.map((table) => table.name);
  assertEveryTableClassified(names);

  const live = await tx.unsafe<{ name: string; forced: boolean }[]>(
    `SELECT c.relname AS name, c.relforcerowsecurity AS forced
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
  );
  const liveNames = live.map((row) => row.name);
  const drift = [
    ...liveNames.filter((name) => !names.includes(name)),
    ...names.filter((name) => !liveNames.includes(name)),
  ];
  if (drift.length > 0) {
    throw new ResetRefusal(
      `The database and the schema disagree about ${drift.sort().join(', ')}; migrate first.`,
    );
  }

  const authTables: string[] = [];
  if (options.auth) {
    const [found] = await tx.unsafe<{ users: boolean; codes: boolean }[]>(
      `SELECT to_regclass('neon_auth."user"') IS NOT NULL AS users,
              to_regclass('neon_auth.verification') IS NOT NULL AS codes`,
    );
    if (!found?.users) {
      throw new ResetRefusal('--auth needs the neon_auth schema, and this database has none.');
    }
    authTables.push(NEON_AUTH_USERS, ...(found.codes ? [NEON_AUTH_CODES] : []));
  }

  /*
   * `messages` forces row-level security on its owner too, and its policies
   * name only `app_api`: a migration role without BYPASSRLS would count, and
   * delete, nothing there. Lifted before counting and restored before commit,
   * like the append-only triggers, so no other session ever sees either off.
   */
  const order = deletionOrder(tables);
  const planned = [...Object.keys(KEPT_TABLES), ...order, ...authTables];

  /*
   * Writers wait until commit, bounded by the session's lock timeout: a row
   * the live API wrote between a table's delete and the recount would fail
   * the run, and one written after the recount would survive it.
   */
  await tx.unsafe(`LOCK TABLE ${planned.map(quoted).join(', ')} IN EXCLUSIVE MODE`);

  const forced = live.filter((row) => row.forced).map((row) => row.name);
  for (const name of forced) {
    await tx.unsafe(`ALTER TABLE "${name}" NO FORCE ROW LEVEL SECURITY`);
  }
  for (const [table, trigger] of Object.entries(APPEND_ONLY_DELETE_TRIGGERS)) {
    await tx.unsafe(`ALTER TABLE "${table}" DISABLE TRIGGER "${trigger}"`);
  }

  const plan: PlanRow[] = [];
  for (const table of planned) {
    plan.push(await countRows(tx, table));
  }

  for (const line of formatPlan(plan)) {
    options.log(line);
  }

  if (options.dryRun) {
    options.log('Dry run: nothing was deleted.');
    throw new DryRunRollback(plan);
  }
  if (!options.yes) {
    throw new ResetRefusal('Nothing was deleted. Re-run with --yes to delete the rows above.');
  }

  for (const [index, table] of order.entries()) {
    await options.beforeTable?.(table, index);
    const keep = PARTIAL_TABLES[table];
    await tx.unsafe(
      keep
        ? `DELETE FROM "${table}" WHERE NOT coalesce((${keep}), false)`
        : `DELETE FROM "${table}"`,
    );
  }
  for (const table of authTables) {
    await tx.unsafe(`DELETE FROM ${table} WHERE NOT coalesce((${NEON_AUTH_KEEP[table]}), false)`);
  }

  for (const expected of plan) {
    const actual = await countRows(tx, expected.table);
    if (actual.total !== expected.keep) {
      throw new Error(
        `${expected.table} holds ${actual.total} rows after the reset, not ${expected.keep}.`,
      );
    }
  }

  for (const [table, trigger] of Object.entries(APPEND_ONLY_DELETE_TRIGGERS)) {
    await tx.unsafe(`ALTER TABLE "${table}" ENABLE TRIGGER "${trigger}"`);
  }
  for (const name of forced) {
    await tx.unsafe(`ALTER TABLE "${name}" FORCE ROW LEVEL SECURITY`);
  }

  options.log(`Reset ${database}: ${plan.reduce((sum, row) => sum + row.delete, 0)} rows deleted.`);
  return { plan, deleted: true };
}

/** Strips the connection string and its password out of a message before it is printed. */
export function redact(message: string, connectionString: string): string {
  let password = '';
  try {
    password = decodeURIComponent(new URL(connectionString).password);
  } catch {
    // An unparseable string has no password segment to find.
  }
  let safe = connectionString
    ? message.split(connectionString).join('<connection string>')
    : message;
  if (password) {
    safe = safe.split(password).join('<password>');
  }
  return safe;
}

export interface ResetIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

/** The whole CLI: parse, check the host, connect as the migration role, reset. Returns the exit code. */
export async function runResetCli(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
  io: ResetIo,
  beforeTable?: ResetOptions['beforeTable'],
): Promise<number> {
  let connectionString = '';
  try {
    const args = parseResetArgs(argv);
    connectionString = resolveMigrationUrl(env);
    const { host, port } = assertTierMatchesHost(args.tier, connectionString);

    const sql = postgres(connectionString, {
      host: host.replace(/^\[|\]$/g, ''),
      port,
      max: 1,
      // Widened as `createDatabase` does: postgres.js sends these as startup strings.
      connection: MIGRATION_SESSION_SETTINGS as Record<string, string>,
      onnotice: () => {},
    });
    try {
      await resetDatabase(sql, { ...args, log: io.out, beforeTable });
    } finally {
      await sql.end();
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const prefix = error instanceof ResetRefusal ? 'Refused' : 'Reset failed, nothing changed';
    io.err(redact(`${prefix}: ${message}`, connectionString));
    return 1;
  }
}
