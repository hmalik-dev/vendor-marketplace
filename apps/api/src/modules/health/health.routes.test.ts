import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectedMigrationCount } from '@vendor-marketplace/db';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';
import { deployedCommit, RELEASE_COMMIT_FILE } from './health.routes.js';

describe('GET /health', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('reports the process as live', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
    expect(typeof response.json().timestamp).toBe('string');
  });

  it('needs no authentication', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
  });

  it('answers an unknown route with the structured error shape', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/v1/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ statusCode: 404, error: 'NOT_FOUND' });
  });
});

describe('GET /ready', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('reports both dependencies up and needs no authentication', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ready',
      database: 'up',
      storage: 'up',
    });
    expect(typeof response.json().timestamp).toBe('string');
  });

  /*
   * A post-deploy check has to know *which* build answered, or the previous,
   * still-healthy release will vouch for a new one that never booted.
   */
  it('names the commit it is serving', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/ready' });

    // Off a platform there is no SHA to report, and null is the honest answer.
    expect(response.json().commit).toBeNull();
  });

  it('stays ready and names storage down when only the bucket is unreachable (VEN-671)', async () => {
    harness.setStorageAvailable(false);

    try {
      const response = await harness.app.inject({ method: 'GET', url: '/ready' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        status: 'ready',
        database: 'up',
        storage: 'down',
      });
    } finally {
      harness.setStorageAvailable(true);
    }
  });

  it('does not check the database role on a local API', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/ready' });

    expect(response.json()).toMatchObject({ rowLevelSecurity: 'not_checked', reason: null });
  });
});

/*
 * A build whose migrations have not run passes a bare round trip and then fails
 * every route that touches the missing table or column (VEN-495).
 */
describe('GET /ready migration level', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  async function appliedMigrations(): Promise<number> {
    const rows = await harness.app.db
      .select({ applied: sql<number>`count(*)::int` })
      .from(sql`drizzle.__drizzle_migrations`);

    return rows[0]?.applied ?? -1;
  }

  it('applies exactly the migrations the journal ships, and is ready', async () => {
    expect(await appliedMigrations()).toBe(expectedMigrationCount());

    const response = await harness.app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ready', database: 'up', storage: 'up' });
  });

  it('answers 503 naming the database "behind" when one migration is missing', async () => {
    await harness.app.db.execute(
      sql`delete from drizzle.__drizzle_migrations where id = (select max(id) from drizzle.__drizzle_migrations)`,
    );

    try {
      expect(await appliedMigrations()).toBe(expectedMigrationCount() - 1);

      const response = await harness.app.inject({ method: 'GET', url: '/ready' });

      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        status: 'not_ready',
        database: 'behind',
        storage: 'up',
      });
    } finally {
      await harness.app.db.execute(
        sql`insert into drizzle.__drizzle_migrations (hash, created_at) values ('restored', 0)`,
      );
    }
  });

  it('stays ready when the database is ahead of the build, so a rollback keeps serving', async () => {
    await harness.app.db.execute(
      sql`insert into drizzle.__drizzle_migrations (hash, created_at) values ('from-a-newer-build', 0)`,
    );

    try {
      expect(await appliedMigrations()).toBe(expectedMigrationCount() + 1);

      const response = await harness.app.inject({ method: 'GET', url: '/ready' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: 'ready', database: 'up' });
    } finally {
      await harness.app.db.execute(
        sql`delete from drizzle.__drizzle_migrations where hash = 'from-a-newer-build'`,
      );
    }
  });
});

/*
 * Liveness must not depend on the database: a probe that fails while the
 * process is healthy gets the container restarted, which cannot fix a database
 * outage and drops every in-flight request on the way.
 */
describe('probes with the database stopped', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness();
    await harness.database.close();
  });

  afterAll(async () => {
    await harness.app.close();
  });

  it('still reports the process live on /health', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });

  it('answers 503 naming the database on /ready', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: 'not_ready', database: 'down' });
  });
});

describe('deployedCommit', () => {
  it("reads Railway's injected SHA", () => {
    expect(deployedCommit({ RAILWAY_GIT_COMMIT_SHA: 'abc123' })).toBe('abc123');
  });

  /*
   * The deploy workflow sets `SENTRY_RELEASE`, and the post-deploy poll waits
   * for `/ready` to name it. The error tracker reads the same variable, so the
   * commit the poll accepted is the release an error is filed under (VEN-397).
   */
  it('names the release the deploy workflow set, ahead of the platform SHA', () => {
    expect(deployedCommit({ SENTRY_RELEASE: 'wf-sha', RAILWAY_GIT_COMMIT_SHA: 'abc123' })).toBe(
      'wf-sha',
    );
  });

  /* A blank or absent value must not become an empty-string "commit". */
  it.each([{}, { RAILWAY_GIT_COMMIT_SHA: '' }, { RAILWAY_GIT_COMMIT_SHA: '   ' }])(
    'has no commit for %p',
    (source) => {
      expect(deployedCommit(source)).toBeNull();
    },
  );
});

describe('deployedCommit: the commit baked into the image (VEN-634)', () => {
  const baked = 'b'.repeat(40);
  const stale = 'a'.repeat(40);
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'release-commit-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports the baked commit even when SENTRY_RELEASE names a different sha', () => {
    const file = path.join(dir, 'RELEASE_COMMIT');
    writeFileSync(file, `${baked}\n`);

    expect(deployedCommit({ SENTRY_RELEASE: stale, RAILWAY_GIT_COMMIT_SHA: stale }, file)).toBe(
      baked,
    );
  });

  it.each(['', '  \n'])('falls back to the variables when the file holds %j', (content) => {
    const file = path.join(dir, 'RELEASE_COMMIT');
    writeFileSync(file, content);

    expect(deployedCommit({ SENTRY_RELEASE: stale }, file)).toBe(stale);
  });

  it('falls back to the variables when there is no file, and has none without them', () => {
    const file = path.join(dir, 'missing');

    expect(deployedCommit({ SENTRY_RELEASE: stale }, file)).toBe(stale);
    expect(deployedCommit({}, file)).toBeNull();
  });
});

describe('the image bakes the commit the API reads (VEN-634)', () => {
  const dockerfile = readFileSync(
    fileURLToPath(new URL('../../../Dockerfile', import.meta.url)),
    'utf8',
  );

  it('writes the RELEASE_COMMIT build arg to the file deployedCommit reads, in the runtime stage', () => {
    const runtime = dockerfile.slice(dockerfile.indexOf('FROM base AS runtime'));

    expect(runtime).toContain('ARG RELEASE_COMMIT');
    expect(runtime).toContain(`> ${RELEASE_COMMIT_FILE}`);
  });
});
