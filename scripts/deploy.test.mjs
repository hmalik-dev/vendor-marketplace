/**
 * VEN-397. The deploy's phases, and a dry run of `.github/workflows/deploy.yml`
 * itself: its steps are executed in order, the way Actions executes them, with
 * `git`, `pnpm` and `npx` replaced by stubs that record what they were asked to
 * do. That is what "tested, not assumed" means here without a production
 * account: the order, the abort on a failed migration, the failed poll, the
 * failure, by name, when nothing or only part of the configuration is set, and
 * no secret in any log. Runs under plain `node` via `pnpm test:agents`.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

import {
  API_HOSTS,
  PHASES,
  PhaseError,
  REQUIRED_INPUTS,
  SKEW_RUNBOOK_STEP,
  gateVerdict,
  missingInputs,
  presenceFlag,
  redactor,
  run,
} from './deploy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = parse(readFileSync(path.join(ROOT, '.github/workflows/deploy.yml'), 'utf8'));
const CI = parse(readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8'));
const JOB = WORKFLOW.jobs.deploy;
const SHA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

/*
 * Credential-shaped values are composed, never written out: a literal of that
 * shape is what the secret scanner and the credential hook exist to stop.
 */
const fake = (label) => ['dry', 'run', label, 'credential'].join('-');
const UNPOOLED = ['postgresql://deploy:', fake('password'), '@127.0.0.1:1/orla'].join('');

/** The two Secret-type Vercel variables the release build validates (VEN-575). */
const BUILD_SECRETS = {
  WEB_TIER_KEY: fake('web-tier-key'),
  NEON_AUTH_COOKIE_SECRET: fake('cookie-secret'),
};

// Every `RUNTIME_VARS` entry present, matching `/api/ready`'s shape once VEN-631 lands.
const RUNTIME_ENV_PRESENT = {
  NEON_AUTH_BASE_URL: true,
  NEON_AUTH_COOKIE_SECRET: true,
  WEB_TIER_KEY: true,
  DEPLOY_ENV: true,
  WEB_URL: true,
};
const RUNTIME_ENV_ABSENT = Object.fromEntries(
  Object.keys(RUNTIME_ENV_PRESENT).map((name) => [name, false]),
);
const SIGN_IN_HTML = '<html><body><form><input type="email" name="email" /></form></body></html>';

/*
 * VEN-660. The Neon project as preflight sees it: each tier's branch has its own
 * Neon Auth and trusts only its own web host. Composed per tier so a test can
 * hand one tier the other's value and watch the guard refuse it.
 */
const NEON_AUTH = {
  production: 'https://ep-prod.neonauth.test/neondb/auth',
  staging: 'https://ep-staging.neonauth.test/neondb/auth',
};
const NEON_WORLD = {
  production: { id: 'br-prod', domains: ['https://orla.test'] },
  staging: { id: 'br-staging', domains: ['https://orla-staging.test'] },
};

/** Answers the three Neon API reads `checkNeonAuth` makes, from `world`; records each URL. */
function neonFetch(world = NEON_WORLD, seen = []) {
  return async (url, init) => {
    seen.push({ url, authorization: init?.headers?.authorization });
    const { pathname } = new URL(url);
    const match = /^\/api\/v2\/projects\/[^/]+\/branches(?:\/([^/]+)\/auth(\/domains)?)?$/.exec(
      pathname,
    );
    if (!match) {
      return new Response('not found', { status: 404 });
    }
    const [, branchId, domains] = match;
    if (!branchId) {
      return Response.json({
        branches: Object.entries(world).map(([name, { id }]) => ({ id, name })),
      });
    }
    const [name, branch] = Object.entries(world).find(([, { id }]) => id === branchId) ?? [];
    if (!branch) {
      return new Response('not found', { status: 404 });
    }
    return domains
      ? Response.json({
          domains: branch.domains.map((domain) => ({ domain, auth_provider: 'better_auth' })),
        })
      : Response.json({ base_url: NEON_AUTH[name] });
  };
}

/**
 * A healthy origin for both `webNamesRelease` and `webServesCoreFlows`:
 * `/api/ready` names `commit` and reports `runtimeEnv`, `/api/auth/get-session`
 * answers a null JSON session, `/sign-in` renders the form's marker, and
 * anything else (the home page) answers 200.
 */
function coreFlowsFetch({ commit = SHA, runtimeEnv = RUNTIME_ENV_PRESENT } = {}) {
  return async (url) => {
    const { pathname } = new URL(url);
    if (pathname === '/api/ready') {
      return Response.json({ commit, runtimeEnv });
    }
    if (pathname === '/api/auth/get-session') {
      return new Response('null', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (pathname === '/sign-in') {
      return new Response(SIGN_IN_HTML, { status: 200 });
    }
    return new Response('ok', { status: 200 });
  };
}

/** The deployment URL `vercel deploy` prints as its last line (`web-deploy` reads it). */
const DEPLOY_URL = 'https://orla-abc123-team.vercel.app';

function recordingIo() {
  const calls = [];
  const lines = [];
  return {
    calls,
    lines,
    io: {
      run: async (command, args, options) => {
        calls.push({ command, args, env: options.env });
        if (command === 'npx' && args[2] === 'deploy') {
          options.write?.(`${DEPLOY_URL}\n`);
        }
      },
      write: (text) => lines.push(text),
      error: (text) => lines.push(text),
      fetch: neonFetch(),
    },
  };
}

// --- gate -------------------------------------------------------------------

test('gate: a successful push CI run for the tip of an environment branch deploys it', () => {
  for (const branch of ['staging', 'production']) {
    assert.deepEqual(
      gateVerdict({ conclusion: 'success', event: 'push', branch, headSha: SHA, tipSha: SHA }),
      { deploy: true, fail: false, message: `Deploying a1b2c3d to ${branch}.` },
    );
  }
});

test('gate: main, a lane branch or no branch at all never deploys, and fails the run', () => {
  for (const branch of ['main', 'worktree-ven-494', 'staging-2', '', undefined]) {
    const verdict = gateVerdict({
      conclusion: 'success',
      event: 'push',
      branch,
      headSha: SHA,
      tipSha: SHA,
    });
    assert.deepEqual([verdict.deploy, verdict.fail], [false, true], String(branch));
    assert.match(verdict.message, /which is not one of staging, production/);
  }
});

test('gate: skipped, cancelled and every other conclusion are not passing, and fail the run', () => {
  for (const conclusion of [
    'skipped',
    'cancelled',
    'failure',
    'timed_out',
    'action_required',
    'neutral',
    undefined,
  ]) {
    const verdict = gateVerdict({
      conclusion,
      event: 'push',
      branch: 'production',
      headSha: SHA,
      tipSha: SHA,
    });
    assert.deepEqual([verdict.deploy, verdict.fail], [false, true], String(conclusion));
  }
});

test('gate: a pull request CI run never deploys', () => {
  const verdict = gateVerdict({
    conclusion: 'success',
    event: 'pull_request',
    branch: 'production',
    headSha: SHA,
    tipSha: SHA,
  });
  assert.deepEqual([verdict.deploy, verdict.fail], [false, true]);
});

test('gate: a superseded commit does not deploy over a newer one, and does not fail', () => {
  const verdict = gateVerdict({
    conclusion: 'success',
    event: 'push',
    branch: 'staging',
    headSha: SHA,
    tipSha: 'f'.repeat(40),
  });
  assert.deepEqual([verdict.deploy, verdict.fail], [false, false]);
  assert.match(verdict.message, /no longer staging's tip/);
});

// --- preflight --------------------------------------------------------------

function allPresent() {
  return {
    ...Object.fromEntries(REQUIRED_INPUTS.map(({ name }) => [presenceFlag(name), 'true'])),
    API_HOST: 'railway',
    NEON_API_KEY: fake('neon'),
    NEON_PROJECT_ID: 'dark-test-1',
    NEON_BRANCH: 'production',
    NEON_AUTH_BASE_URL: NEON_AUTH.production,
    WEB_URL: 'https://orla.test',
    DEPLOY_TARGET: 'production',
  };
}

test('preflight: nothing configured fails naming every input, never skips', async () => {
  const { io } = recordingIo();
  const error = await PHASES.preflight({}, io).then(
    () => null,
    (caught) => caught,
  );
  assert.ok(error, 'preflight must reject');
  assert.match(error.message, /not fully configured/);
  for (const { name, kind } of REQUIRED_INPUTS) {
    assert.ok(error.message.includes(`${name} (${kind})`), name);
  }
});

test('preflight: partly configured fails naming what is missing and where it is set', async () => {
  const { io } = recordingIo();
  await assert.rejects(
    PHASES.preflight({ ...allPresent(), HAS_SENTRY_AUTH_TOKEN: 'false' }, io),
    /not fully configured.*missing: SENTRY_AUTH_TOKEN \(secret\).*docs\/environments\.md/,
  );
});

test('workflows: ci is read-only and every deploy action is SHA-pinned', () => {
  assert.deepEqual(CI.permissions, { contents: 'read' });
  for (const step of JOB.steps.filter((candidate) => candidate.uses)) {
    assert.match(step.uses, /^[\w./-]+@[0-9a-f]{40}$/, step.uses);
  }
});

// VEN-632: `smoke.yml` duplicated `ready`'s own check and never actually ran it
// (main is never deployed, so its `SMOKE_COMMIT` could never match); `ready`
// now proves auth, sign-in and the home page itself, so there is nothing left
// for a separate post-deploy workflow to check that this gate does not.
test('workflows: the post-deploy smoke workflow is gone, not merely disabled', () => {
  assert.throws(() => readFileSync(path.join(ROOT, '.github/workflows/smoke.yml')), /ENOENT/);
});

test('preflight: one missing input still fails, by name', () => {
  assert.deepEqual(missingInputs({ ...allPresent(), HAS_SENTRY_AUTH_TOKEN: 'false' }), [
    'SENTRY_AUTH_TOKEN (secret)',
  ]);
});

test('preflight: an API host with no adapter fails rather than deploying nowhere', async () => {
  const { io } = recordingIo();
  await assert.rejects(
    PHASES.preflight({ ...allPresent(), API_HOST: 'fly' }, io),
    /API_HOST "fly" has no adapter/,
  );
  await PHASES.preflight(allPresent(), io);
});

// --- preflight: Neon Auth (VEN-660) --------------------------------------------

/** What preflight rejected with, or `null` when it passed. */
async function preflightError(env, fetchImpl = neonFetch()) {
  const { io } = recordingIo();
  return PHASES.preflight(env, { ...io, fetch: fetchImpl }).then(
    () => null,
    (caught) => caught,
  );
}

test("preflight: a tier's own Neon Auth and web host pass, asked of Neon with the key", async () => {
  const seen = [];
  const { io, lines } = recordingIo();
  await PHASES.preflight(allPresent(), { ...io, fetch: neonFetch(NEON_WORLD, seen) });

  assert.deepEqual(
    seen.map(({ url }) => new URL(url).pathname),
    [
      '/api/v2/projects/dark-test-1/branches',
      '/api/v2/projects/dark-test-1/branches/br-prod/auth',
      '/api/v2/projects/dark-test-1/branches/br-prod/auth/domains',
    ],
  );
  for (const { authorization } of seen) {
    assert.equal(authorization, `Bearer ${fake('neon')}`);
  }
  assert.ok(lines.some((line) => line.includes("the production branch's own")));
});

test("preflight: NEON_AUTH_BASE_URL naming another tier's Neon Auth fails the release, by name", async () => {
  const error = await preflightError({ ...allPresent(), NEON_AUTH_BASE_URL: NEON_AUTH.staging });

  assert.ok(error instanceof PhaseError, String(error));
  assert.equal(
    error.message,
    'NEON_AUTH_BASE_URL (ep-staging.neonauth.test) is not the Neon Auth base URL of the production Neon branch (ep-prod.neonauth.test); refusing to release.',
  );
});

test("preflight: WEB_URL that is not among the branch's Neon Auth trusted domains fails the release, by name", async () => {
  const error = await preflightError({
    ...allPresent(),
    WEB_URL: 'https://orla-staging.test,https://orla.test',
  });

  assert.ok(error instanceof PhaseError, String(error));
  assert.equal(
    error.message,
    "WEB_URL (https://orla-staging.test) is not a trusted domain of the production Neon branch's Neon Auth; refusing to release.",
  );
});

test('preflight: a trailing slash on either side is the same base URL and the same host', async () => {
  assert.equal(
    await preflightError({
      ...allPresent(),
      NEON_AUTH_BASE_URL: `${NEON_AUTH.production}/`,
      WEB_URL: 'https://orla.test/',
    }),
    null,
  );
});

test('preflight: a whole variable set fallen back from the other tier fails before Neon is asked', async () => {
  const seen = [];
  const error = await preflightError(
    { ...allPresent(), DEPLOY_TARGET: 'staging' },
    neonFetch(NEON_WORLD, seen),
  );

  assert.equal(
    error.message,
    'NEON_BRANCH "production" is not the staging environment\'s Neon branch; refusing to release.',
  );
  assert.equal(seen.length, 0);
});

test('preflight: a NEON_BRANCH Neon does not have, or a branch without Neon Auth, fails', async () => {
  const missing = await preflightError({
    ...allPresent(),
    NEON_BRANCH: 'prod',
    DEPLOY_TARGET: 'prod',
  });
  assert.match(missing.message, /^NEON_BRANCH "prod" is not a branch of NEON_PROJECT_ID/);

  const noAuth = async (url, init) =>
    new URL(url).pathname.endsWith('/auth')
      ? new Response('{"message":"not enabled"}', { status: 404 })
      : neonFetch()(url, init);
  const disabled = await preflightError(allPresent(), noAuth);
  assert.equal(
    disabled.message,
    "The Neon API answered HTTP 404 for the production branch's Neon Auth; refusing to release.",
  );
});

test('preflight: a Neon API that cannot be reached fails closed and never prints the key', async () => {
  const error = await preflightError(allPresent(), async () => {
    throw new Error(`connect failed with ${fake('neon')}`);
  });

  assert.equal(error.message, 'The Neon API did not answer for the branches; refusing to release.');
  assert.ok(!error.message.includes(fake('neon')));
});

// --- migrate ----------------------------------------------------------------

/** The two variables that say which environment a run deploys and which Neon branch it was given. */
const TARGET = (target, branch = target) => ({
  DEPLOY_TARGET: target,
  NEON_BRANCH: branch,
  NEON_HOST: new URL(UNPOOLED).hostname,
});

test('migrate: refuses to run without the unpooled URL', async () => {
  const { io, calls } = recordingIo();
  await assert.rejects(PHASES.migrate({ PATH: '/bin' }, io), /Missing DATABASE_URL_UNPOOLED/);
  assert.equal(calls.length, 0);
});

test('migrate: refuses a step that was also handed the pooled URL', async () => {
  const { io, calls } = recordingIo();
  await assert.rejects(
    PHASES.migrate(
      {
        ...TARGET('production'),
        DATABASE_URL_UNPOOLED: UNPOOLED,
        DATABASE_URL: 'postgresql://pooled.example/orla',
      },
      io,
    ),
    /migrations take DATABASE_URL_UNPOOLED only/,
  );
  assert.equal(calls.length, 0);
});

test('migrate: refuses when NEON_BRANCH names a different environment than the one deploying', async () => {
  for (const [target, branch] of [
    ['staging', 'production'],
    ['production', 'staging'],
    ['production', 'dev'],
    ['staging', 'Staging'],
  ]) {
    const { io, calls } = recordingIo();
    await assert.rejects(
      PHASES.migrate({ ...TARGET(target, branch), DATABASE_URL_UNPOOLED: UNPOOLED }, io),
      new PhaseError(
        `NEON_BRANCH "${branch}" is not the ${target} environment's Neon branch (expected "${target}"); refusing to migrate.`,
      ),
    );
    assert.equal(calls.length, 0, `${target} against ${branch}`);
  }
});

test('migrate: refuses a secret from another environment even when NEON_BRANCH is right', async () => {
  const { io, calls } = recordingIo();
  const otherTier = ['postgresql://deploy:', fake('other'), '@ep-production.neon.test/orla'].join(
    '',
  );
  await assert.rejects(
    PHASES.migrate({ ...TARGET('staging'), DATABASE_URL_UNPOOLED: otherTier }, io),
    new PhaseError(
      "DATABASE_URL_UNPOOLED is not on NEON_HOST, the staging environment's Neon endpoint; refusing to migrate.",
    ),
  );
  assert.equal(calls.length, 0);
});

test('migrate: refuses without a Neon branch, or when the target is not an environment', async () => {
  const { io, calls } = recordingIo();
  await assert.rejects(
    PHASES.migrate({ DEPLOY_TARGET: 'staging', DATABASE_URL_UNPOOLED: UNPOOLED }, io),
    /Missing NEON_BRANCH/,
  );
  await assert.rejects(
    PHASES.migrate({ ...TARGET('main'), DATABASE_URL_UNPOOLED: UNPOOLED }, io),
    /DEPLOY_TARGET "main" is not one of staging, production; refusing to migrate\./,
  );
  assert.equal(calls.length, 0);
});

test('migrate: migrations receive only DATABASE_URL_UNPOOLED, then the reference seed runs over it', async () => {
  const { io, calls } = recordingIo();
  const unrelated = { VERCEL_TOKEN: fake('vercel') };
  await PHASES.migrate(
    { PATH: '/bin', ...TARGET('staging'), DATABASE_URL_UNPOOLED: UNPOOLED, ...unrelated },
    io,
  );

  assert.deepEqual(
    calls.map(({ command, args }) => [command, ...args].join(' ')),
    ['pnpm db:migrate', 'pnpm db:seed'],
  );
  assert.deepEqual(calls[0].env, { PATH: '/bin', DATABASE_URL_UNPOOLED: UNPOOLED });
  assert.deepEqual(calls[1].env, {
    PATH: '/bin',
    DATABASE_URL_UNPOOLED: UNPOOLED,
    DATABASE_URL: UNPOOLED,
  });
});

// --- api and web ------------------------------------------------------------

test('api: deploys through the named host adapter with its credential and the release', async () => {
  const { io, calls } = recordingIo();
  const credentials = { API_HOST_TOKEN: fake('api'), VERCEL_TOKEN: fake('vercel') };
  await PHASES.api(
    {
      PATH: '/bin',
      API_HOST: 'railway',
      API_SERVICE: 'orla-api',
      SENTRY_RELEASE: SHA,
      NEON_AUTH_BASE_URL: NEON_AUTH.production,
      ...credentials,
    },
    io,
  );

  assert.deepEqual(
    calls.map(({ args }) => args.slice(2).join(' ')),
    [
      `variables --service orla-api --set SENTRY_RELEASE=${SHA} --set RELEASE_COMMIT=${SHA} --set NEON_AUTH_BASE_URL=${NEON_AUTH.production} --skip-deploys`,
      'up --ci --service orla-api',
    ],
  );
  for (const call of calls) {
    assert.deepEqual(call.env, {
      PATH: '/bin',
      [API_HOSTS.railway.credentialVariable]: fake('api'),
    });
  }
});

test('api: an unknown host fails without running anything', async () => {
  const { io, calls } = recordingIo();
  const credentials = { API_HOST_TOKEN: fake('api') };
  await assert.rejects(
    PHASES.api(
      {
        API_HOST: 'render',
        API_SERVICE: 's',
        SENTRY_RELEASE: SHA,
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
        ...credentials,
      },
      io,
    ),
    /no adapter/,
  );
  assert.equal(calls.length, 0);
});

test('web-build: builds under the release and upload credential, deployment secrets excluded', async () => {
  const { io, calls } = recordingIo();
  const credentials = {
    VERCEL_TOKEN: fake('vercel'),
    SENTRY_AUTH_TOKEN: fake('sentry'),
    ...BUILD_SECRETS,
  };
  await PHASES['web-build'](
    {
      PATH: '/bin',
      DEPLOY_TARGET: 'production',
      VERCEL_ORG_ID: 'org',
      VERCEL_PROJECT_ID: 'prj',
      SENTRY_WEB_PROJECT: 'orla-web',
      SENTRY_RELEASE: SHA,
      DATABASE_URL_UNPOOLED: UNPOOLED,
      WEB_URL: 'https://orla.test',
      NEON_AUTH_BASE_URL: NEON_AUTH.production,
      API_URL: 'https://api.orla.test',
      ...credentials,
    },
    io,
  );

  assert.deepEqual(
    calls.map(({ args }) => args[2]),
    ['pull', 'build'],
  );
  assert.equal(calls[1].env.SENTRY_RELEASE, SHA);
  assert.equal(calls[1].env.SENTRY_AUTH_TOKEN, fake('sentry'));
  for (const call of calls) {
    assert.equal(call.env.DATABASE_URL_UNPOOLED, undefined);
  }
});

test('web-deploy: deploys the prebuilt bundle without the upload or build-only credentials, after the build', async () => {
  const { io, calls } = recordingIo();
  await PHASES['web-deploy'](
    {
      PATH: '/bin',
      DEPLOY_TARGET: 'production',
      VERCEL_TOKEN: fake('vercel'),
      VERCEL_ORG_ID: 'org',
      VERCEL_PROJECT_ID: 'prj',
      SENTRY_RELEASE: SHA,
      // Handed to this call the way `release` hands every phase the whole
      // environment; none of these belong to `vercel deploy`'s own child.
      SENTRY_AUTH_TOKEN: fake('sentry'),
      ...BUILD_SECRETS,
      DATABASE_URL_UNPOOLED: UNPOOLED,
      WEB_URL: 'https://orla.test',
      NEON_AUTH_BASE_URL: NEON_AUTH.production,
    },
    io,
  );

  assert.deepEqual(
    calls.map(({ args }) => args[2]),
    ['deploy', 'promote'],
  );
  assert.equal(calls[0].env.SENTRY_AUTH_TOKEN, undefined);
  assert.ok(calls[0].args.includes(`SENTRY_RELEASE=${SHA}`));
  assert.equal(calls[0].env.DATABASE_URL_UNPOOLED, undefined);
  for (const name of Object.keys(BUILD_SECRETS)) {
    assert.equal(calls[0].env[name], undefined, name);
  }
});

test('web-deploy: refuses without the vercel credentials or the release commit, before running anything', async () => {
  const { io, calls } = recordingIo();
  await assert.rejects(
    PHASES['web-deploy']({ DEPLOY_TARGET: 'production' }, io),
    /Missing VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID, SENTRY_RELEASE, NEON_AUTH_BASE_URL/,
  );
  assert.equal(calls.length, 0);
});

// Run standalone (a manual release, not through `release`), `web-deploy` must
// refuse the same alias mismatch `web-build` already refuses inside `release`
// — otherwise a lone `web-deploy` could alias production's host to a stray
// staging build.
test('web-deploy: staging refuses to alias a host that is not its own, even called on its own', async () => {
  const { io, calls } = recordingIo();
  for (const WEB_URL of ['https://orla.example', 'orla-staging.vercel.app', '']) {
    await assert.rejects(
      PHASES['web-deploy'](
        {
          DEPLOY_TARGET: 'staging',
          VERCEL_TOKEN: fake('vercel'),
          VERCEL_ORG_ID: 'org',
          VERCEL_PROJECT_ID: 'prj',
          SENTRY_RELEASE: SHA,
          WEB_URL,
          NEON_AUTH_BASE_URL: NEON_AUTH.production,
        },
        io,
      ),
      /WEB_URL/,
    );
  }
  assert.equal(calls.length, 0);
});

test('ready: polls through the smoke check, then proves the web serves auth, sign-in and home', async () => {
  const { io, calls } = recordingIo();
  const asked = [];
  const fetchWithLog = coreFlowsFetch();
  io.fetch = async (url) => {
    asked.push(new URL(url).pathname);
    return fetchWithLog(url);
  };
  await PHASES.ready(
    {
      PATH: '/bin',
      API_URL: 'https://api.orla.test',
      WEB_URL: 'https://orla.test',
      NEON_AUTH_BASE_URL: NEON_AUTH.production,
      SENTRY_RELEASE: SHA,
    },
    io,
  );

  assert.deepEqual(asked, ['/api/ready', '/api/auth/get-session', '/sign-in', '/']);
  assert.deepEqual(
    calls.map(({ command, args, env }) => ({ command, args, env })),
    [
      {
        command: 'pnpm',
        args: ['smoke'],
        env: {
          PATH: '/bin',
          SMOKE_API_URL: 'https://api.orla.test',
          SMOKE_WEB_URL: 'https://orla.test',
          SMOKE_COMMIT: SHA,
          SMOKE_DEADLINE_MS: '600000',
        },
      },
    ],
  );
});

// --- secrets in output --------------------------------------------------------

test('redactor: removes a secret, and the password inside a connection string on its own', () => {
  const redact = redactor([UNPOOLED, fake('vercel')]);
  const { password } = new URL(UNPOOLED);

  assert.equal(
    redact(`connecting to ${UNPOOLED} with ${fake('vercel')}`),
    'connecting to *** with ***',
  );
  assert.equal(
    redact(`password authentication failed: ${password}`),
    'password authentication failed: ***',
  );
});

test('run: a child that prints a secret has it redacted, on stdout and stderr', async () => {
  const out = [];
  await run(
    process.execPath,
    ['-e', `console.log(process.env.S); console.error('err ' + process.env.S)`],
    { env: { S: UNPOOLED }, redact: redactor([UNPOOLED]), write: (text) => out.push(text) },
  );
  assert.deepEqual(out.sort(), ['***\n', 'err ***\n']);
});

// A real migration against a database that cannot be reached: the phase fails,
// so the workflow stops, and the log carries no part of the credential.
test('migrate: a failed migration exits non-zero, runs no seed and prints no part of the URL', () => {
  const result = spawnSync(process.execPath, ['scripts/deploy.mjs', 'migrate'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      DATABASE_URL_UNPOOLED: UNPOOLED,
      ...TARGET('staging'),
    },
    encoding: 'utf8',
    timeout: 120_000,
  });
  const log = result.stdout + result.stderr;

  assert.equal(result.status, 1, log);
  assert.match(log, /pnpm db:migrate exited with 1/);
  assert.match(log, /Migration failed/);
  assert.ok(!log.includes(new URL(UNPOOLED).password), log);
});

// --- release ------------------------------------------------------------------

/**
 * Every phase name `release` calls, in call order — deliberately not the
 * `PHASES` insertion order, so this fails if `release` is reordered without
 * this test being touched too.
 */
const RELEASE_PHASES = [
  'gate',
  'preflight',
  'sender',
  'web-build',
  'migrate',
  'api',
  'web-deploy',
  'ready',
];

/** Replaces every named phase with a recording stub, runs `fn`, then restores the originals. */
async function withStubbedPhases(names, stub, fn) {
  const originals = Object.fromEntries(names.map((name) => [name, PHASES[name]]));
  for (const name of names) {
    PHASES[name] = stub(name);
  }
  try {
    await fn();
  } finally {
    Object.assign(PHASES, originals);
  }
}

test('release: VEN-633 AC2 — runs gate → preflight → sender → web-build → migrate → api → web-deploy → ready, in that order', async () => {
  const order = [];
  await withStubbedPhases(
    RELEASE_PHASES,
    (name) => async () => {
      order.push(name);
      if (name === 'gate') {
        return { deploy: true };
      }
    },
    async () => {
      await PHASES.release({}, recordingIo().io);
    },
  );

  assert.deepEqual(order, RELEASE_PHASES);
});

test('release: a superseded gate verdict stops before preflight, and does not throw', async () => {
  const order = [];
  await withStubbedPhases(
    RELEASE_PHASES,
    (name) => async () => {
      order.push(name);
      if (name === 'gate') {
        return { deploy: false };
      }
    },
    async () => {
      await PHASES.release({}, recordingIo().io);
    },
  );

  assert.deepEqual(order, ['gate']);
});

// --- the workflow file ----------------------------------------------------------

test('workflow: runs after CI completes on staging or production only, never on main', () => {
  assert.equal(CI.name, 'CI');
  assert.deepEqual(WORKFLOW.on.workflow_run, {
    workflows: ['CI'],
    types: ['completed'],
    branches: ['staging', 'production'],
  });
  assert.deepEqual(Object.keys(WORKFLOW.on).sort(), ['workflow_dispatch', 'workflow_run']);
  assert.ok(!JSON.stringify(WORKFLOW.on).includes('main'));
  // CI must run on the branches the deploy waits for, or it never fires.
  for (const branch of ['staging', 'production']) {
    assert.ok(CI.on.push.branches.includes(branch), branch);
  }
  // A CI run deploys only when it succeeded on a push to an environment branch; the manual path is the other arm.
  assert.equal(
    JOB.if,
    "github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push' && (github.event.workflow_run.head_branch == 'staging' || github.event.workflow_run.head_branch == 'production'))",
  );
});

test('workflow: the branch is the environment, so each has its own secrets and variables', () => {
  const target = '${{ github.event.workflow_run.head_branch || inputs.environment }}';
  assert.equal(JOB.environment, target);
  assert.equal(JOB.env.DEPLOY_TARGET, target);
});

test('workflow: serialises deploys per environment and never cancels one in flight', () => {
  assert.deepEqual(WORKFLOW.concurrency, {
    // The head repository is in the key so a fork's branch of the same name cannot queue in front of a real deploy.
    group:
      'deploy-${{ github.event.workflow_run.head_repository.full_name || github.repository }}-${{ github.event.workflow_run.head_branch || inputs.environment }}',
    'cancel-in-progress': false,
  });
  assert.equal(JOB.concurrency, undefined);
});

test('workflow: no step outlives a failure before it', () => {
  for (const step of JOB.steps) {
    assert.equal(step['continue-on-error'], undefined, step.name);
    assert.equal(step.if, undefined, step.name);
  }
});

/*
 * VEN-633: this file used to name every phase as its own step, conditional on
 * an earlier step's `id`. Deleting that `id` — an edit that looked redundant
 * beside `name:` — silently turned every later condition into a skip, and the
 * job reported success having deployed nothing. A single `release` step
 * removes the class of bug: there is no id for a typo to break, because there
 * is nothing left here for a step to be conditional on.
 */
test('workflow: exactly one step runs deploy.mjs, and only its release phase', () => {
  const invocations = JOB.steps.filter((step) => /deploy\.mjs/.test(step.run ?? ''));

  assert.equal(invocations.length, 1);
  assert.equal(invocations[0].name, 'Release');
  assert.equal(invocations[0].run, 'node scripts/deploy.mjs release');
});

test('workflow: the checkout step names the commit CI tested, before anything else runs', () => {
  const [checkout, ...rest] = JOB.steps;

  assert.match(checkout.uses, /^actions\/checkout@[0-9a-f]{40}$/);
  assert.equal(checkout.with.ref, '${{ github.event.workflow_run.head_sha || inputs.sha }}');
  assert.ok(rest.length > 0);
});

test('workflow: only the release step is handed a database URL, and only the unpooled one', () => {
  const release = JOB.steps.find((step) => step.run === 'node scripts/deploy.mjs release');
  const holders = JOB.steps.filter((step) =>
    Object.values(step.env ?? {}).some((value) => /secrets\.DATABASE_URL[A-Z_]* \}\}/.test(value)),
  );

  assert.deepEqual(holders, [release]);
  assert.equal(release.env.DATABASE_URL_UNPOOLED, '${{ secrets.DATABASE_URL_UNPOOLED }}');
  assert.equal(release.env.NEON_BRANCH, '${{ vars.NEON_BRANCH }}');
  assert.equal(release.env.NEON_HOST, '${{ vars.NEON_HOST }}');
  // "Only the unpooled one": no DATABASE_URL (pooled) key reaches this step or
  // the job at large, or `migrate`'s own `DATABASE_URL` refusal (VEN-377)
  // would never fire in a real run.
  assert.deepEqual(
    Object.keys(release.env).filter((key) => key.startsWith('DATABASE_URL')),
    ['DATABASE_URL_UNPOOLED'],
  );
  assert.ok(!Object.keys(JOB.env).some((key) => key.startsWith('DATABASE_URL')));
});

test('workflow: preflight is told exactly which inputs are set, and never a secret value', () => {
  const release = JOB.steps.find((step) => step.run === 'node scripts/deploy.mjs release');
  const flags = Object.entries(release.env).filter(([key]) => key.startsWith('HAS_'));

  assert.deepEqual(
    flags.map(([key]) => key).sort(),
    REQUIRED_INPUTS.map(({ name }) => presenceFlag(name)).sort(),
  );
  for (const [key, value] of flags) {
    assert.match(value, /^\$\{\{ (secrets|vars)\.[A-Z_]+ != '' \}\}$/, key);
  }
});

test('workflow: only the release step is handed the Resend key, with EMAIL_FROM', () => {
  const release = JOB.steps.find((step) => step.run === 'node scripts/deploy.mjs release');
  const holders = JOB.steps.filter((step) =>
    Object.values(step.env ?? {}).some((value) => value.includes(`secrets.${RESEND_KEY} }}`)),
  );

  assert.deepEqual(holders, [release]);
  assert.equal(release.env.EMAIL_FROM, '${{ vars.EMAIL_FROM }}');
  assert.equal(release.env[RESEND_KEY], `\${{ secrets.${RESEND_KEY} }}`);
});

test('sender: runs the check with only its two inputs, and refuses without them', async () => {
  const { calls, io } = recordingIo();
  const env = { PATH: '/bin', EMAIL_FROM: 'noreply@orla.test', [RESEND_KEY]: fake('resend') };

  await PHASES.sender({ ...env, DATABASE_URL_UNPOOLED: UNPOOLED, API_HOST: 'railway' }, io);
  assert.deepEqual(calls, [{ command: 'pnpm', args: ['release:sender'], env }]);

  for (const name of ['EMAIL_FROM', RESEND_KEY]) {
    await assert.rejects(
      PHASES.sender({ ...env, [name]: '' }, io),
      new RegExp(`Missing ${name}; refusing to continue`),
    );
  }
});

test('workflow: only the release step is handed the two build secrets', () => {
  for (const step of JOB.steps) {
    const holders = Object.entries(step.env ?? {}).filter(([, value]) =>
      /secrets\.(WEB_TIER_KEY|NEON_AUTH_COOKIE_SECRET) \}\}/.test(value),
    );
    assert.equal(holders.length, step.run === 'node scripts/deploy.mjs release' ? 2 : 0, step.name);
  }
});

test('workflow: the release the SDKs report is the commit CI tested', () => {
  const sha = '${{ github.event.workflow_run.head_sha || inputs.sha }}';
  assert.equal(JOB.env.SENTRY_RELEASE, sha);
  assert.equal(JOB.steps[0].with.ref, sha);
});

// --- dry run ------------------------------------------------------------------

/*
 * The stubs read their instructions from files beside themselves: each phase
 * hands its children a fixed environment, so anything set for the stub alone
 * would be dropped on the way — which is the behaviour under test.
 *
 * **Every stub but `git ls-remote` prints its whole environment**, and that is
 * what gives `assertNoSecretPrinted` something to catch. Without it the stubs
 * printed only their own argv, so no secret could reach the log whether or not
 * redaction existed, and all three dry-run assertions passed unchanged when
 * `redactor` was replaced with the identity function. `git` is exempt because
 * the gate parses that call's output for main's tip.
 */
const STUB = `#!/bin/sh
here=$(dirname "$0")
call="$(basename "$0") $*"
printf '%s\\n' "$call" >> "$here/invocations.log"
case "$call" in
  "gh run list"*) cat "$here/ci" ;;
  "git ls-remote"*)
    # Answers only for the ref of the branch under test, so a gate that asks for any other sees no tip.
    [ "$3" = "refs/heads/$(cat "$here/branch")" ] && printf '%s\\t%s\\n' "$(cat "$here/tip")" "$3" ;;
  *) env ;;
esac
# \`vercel deploy\` prints the deployment's URL as its last line.
case "$call" in "npx"*" deploy "*) echo "https://orla-stub.vercel.app" ;; esac
fail=$(cat "$here/fail")
if [ -n "$fail" ]; then
  case "$call" in *"$fail"*) echo "stub failure for $fail" >&2; exit 1 ;; esac
fi
exit 0
`;

/** GitHub's expression syntax, for exactly the forms this workflow uses; anything else throws. */
function expand(value, context) {
  return String(value).replace(/\$\{\{\s*(.+?)\s*\}\}/g, (_, expression) => {
    if (expression.includes(' || ')) {
      return (
        expression
          .split(' || ')
          .map((term) => operand(term, context))
          .find((value) => value !== '') ?? ''
      );
    }
    const presence = /^(secrets|vars)\.([A-Z_]+) != ''$/.exec(expression);
    if (presence) {
      return String(context[presence[1]][presence[2]] !== undefined);
    }
    const lookup = /^(secrets|vars)\.([A-Z_]+)$/.exec(expression);
    if (lookup) {
      return context[lookup[1]][lookup[2]] ?? '';
    }
    return operand(expression, context);
  });
}

/** One operand of an `a || b` expression; empty when unset, as in Actions. */
function operand(term, context) {
  if (term.startsWith('github.event.workflow_run.')) {
    return context.workflowRun?.[term.slice('github.event.workflow_run.'.length)] ?? '';
  }
  if (term.startsWith('inputs.')) {
    return context.inputs?.[term.slice('inputs.'.length)] ?? '';
  }
  const known = {
    'github.event_name': context.eventName,
    'github.token': 'dry-run-github-token',
    'github.repository': 'orla/dry-run',
  };
  if (Object.hasOwn(known, term)) {
    return known[term];
  }
  throw new Error(`unsupported expression: ${term}`);
}

/** Executes the job's `run` steps as Actions does: in order, stopping at the first failure. */
function dryRun({
  secrets,
  vars,
  branch = 'production',
  tip = SHA,
  fail = '',
  webCommit = SHA,
  // A manual release: the inputs the dispatch was given, and what CI concluded for that commit.
  dispatch = null,
  ci = 'success',
}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'deploy-dry-run-'));
  try {
    // The web's answers, for the two children that fetch it: node itself is not stubbed.
    // `/api/ready` carries this run's commit and reports every runtime variable
    // present; `/api/auth/get-session`, `/sign-in` and the home page answer
    // healthy so a passing dry run also clears `webServesCoreFlows` (VEN-632).
    writeFileSync(
      path.join(dir, 'web-fetch.mjs'),
      `const NEON_AUTH = ${JSON.stringify(NEON_AUTH)};
const NEON_WORLD = ${JSON.stringify(NEON_WORLD)};
const neonFetch = ${neonFetch.toString()};
globalThis.fetch = async (url, init) => {
  const { hostname, pathname } = new URL(url);
  if (hostname === 'console.neon.tech') {
    return neonFetch()(url, init);
  }
  if (pathname === '/api/ready') {
    return Response.json({
      commit: ${JSON.stringify(webCommit)},
      runtimeEnv: ${JSON.stringify(RUNTIME_ENV_PRESENT)},
    });
  }
  if (pathname === '/api/auth/get-session') {
    return new Response('null', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (pathname === '/sign-in') {
    return new Response(${JSON.stringify(SIGN_IN_HTML)}, { status: 200 });
  }
  return new Response('ok', { status: 200 });
};\n`,
    );
    for (const tool of ['git', 'pnpm', 'npx', 'gh']) {
      writeFileSync(path.join(dir, tool), STUB);
      chmodSync(path.join(dir, tool), 0o755);
    }
    const log = path.join(dir, 'invocations.log');
    const output = path.join(dir, 'github-output');
    writeFileSync(log, '');
    writeFileSync(output, '');
    writeFileSync(path.join(dir, 'tip'), tip);
    writeFileSync(path.join(dir, 'branch'), branch);
    writeFileSync(path.join(dir, 'fail'), fail);
    writeFileSync(path.join(dir, 'ci'), ci);

    const context = {
      secrets,
      vars,
      eventName: dispatch ? 'workflow_dispatch' : 'workflow_run',
      inputs: dispatch ?? undefined,
      workflowRun: dispatch
        ? undefined
        : { conclusion: 'success', event: 'push', head_sha: SHA, head_branch: branch },
    };
    const printed = [];
    const ran = [];
    let failedAt = null;

    for (const step of JOB.steps) {
      // `uses:` steps set up tooling this host already has.
      if (step.uses) {
        continue;
      }

      const env = Object.fromEntries(
        Object.entries({ ...JOB.env, ...step.env }).map(([key, value]) => [
          key,
          expand(value, context),
        ]),
      );
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', step.run], {
        cwd: ROOT,
        env: {
          ...env,
          // A wrong web commit is polled to a zero deadline, not for the workflow's ten minutes.
          ...(webCommit === SHA ? {} : { SMOKE_DEADLINE_MS: '0' }),
          NODE_OPTIONS: `--import ${path.join(dir, 'web-fetch.mjs')}`,
          PATH: `${dir}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
          HOME: dir,
          GITHUB_OUTPUT: output,
          GITHUB_REPOSITORY: 'orla/dry-run',
        },
        encoding: 'utf8',
      });
      ran.push(step.name);
      printed.push(result.stdout, result.stderr);
      if (result.status !== 0) {
        failedAt = step.name;
        break;
      }
    }

    const invocations = readFileSync(log, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split(' ').slice(0, 3).join(' '));
    return { ran, failedAt, invocations, printed: printed.join('') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SECRETS = Object.fromEntries(
  [
    'DATABASE_URL_UNPOOLED',
    'API_HOST_TOKEN',
    'VERCEL_TOKEN',
    'SENTRY_AUTH_TOKEN',
    'WEB_TIER_KEY',
    'NEON_AUTH_COOKIE_SECRET',
    'RESEND_API_KEY',
    'NEON_API_KEY',
  ].map((name) => [name, name === 'DATABASE_URL_UNPOOLED' ? UNPOOLED : fake(name.toLowerCase())]),
);
const VARS = {
  NEON_BRANCH: 'production',
  NEON_HOST: new URL(UNPOOLED).hostname,
  API_HOST: 'railway',
  API_SERVICE: 'orla-api',
  VERCEL_ORG_ID: 'team_x',
  VERCEL_PROJECT_ID: 'prj_x',
  SENTRY_WEB_PROJECT: 'orla-web',
  API_URL: 'https://api.orla.test',
  WEB_URL: 'https://orla.test',
  NEON_AUTH_BASE_URL: NEON_AUTH.production,
  EMAIL_FROM: 'Orla <noreply@orla.test>',
  NEON_PROJECT_ID: 'dark-test-1',
};

/** The Resend key's name, spelled once; its value is always composed. */
const RESEND_KEY = 'RESEND_API_KEY';

/*
 * The stubs print their environment, so each phase's children really do write
 * the credential they were handed to stdout; what this asserts is that
 * `redactor` took it out again on the way through. Replacing `redactor` with
 * the identity function fails every caller of this.
 */
function assertNoSecretPrinted(printed) {
  for (const value of [...Object.values(SECRETS), new URL(UNPOOLED).password]) {
    assert.ok(!printed.includes(value), `printed a secret: ${value.slice(0, 12)}…`);
  }
  // The environment dump reached the log at all — otherwise the loop above is
  // checking a string that never had a chance to hold a secret.
  assert.match(printed, /^PATH=/m, printed.slice(0, 400));
}

test('dry run: a configured release runs sender → web-build → migrate → api → web-deploy → poll, in that order', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS });

  assert.equal(result.failedAt, null, result.printed);
  assert.deepEqual(result.invocations, [
    'pnpm install --frozen-lockfile',
    'pnpm turbo run',
    'git ls-remote origin',
    'pnpm release:sender',
    'npx --yes vercel@59.17.0', // web-build: pull
    'npx --yes vercel@59.17.0', // web-build: build
    'pnpm db:migrate',
    'pnpm db:seed',
    'npx --yes @railway/cli@5.57.2',
    'npx --yes @railway/cli@5.57.2',
    'npx --yes vercel@59.17.0', // web-deploy: deploy
    'npx --yes vercel@59.17.0', // web-deploy: promote (VEN-634)
    'pnpm smoke',
  ]);
  assertNoSecretPrinted(result.printed);
  /*
   * Named, not merely absent. The children were handed these credentials and
   * printed their environment, so these two lines are the redaction happening
   * rather than the secret never having been there — the difference between a
   * guard and a guard's shape.
   */
  assert.match(result.printed, /^DATABASE_URL_UNPOOLED=\*\*\*$/m);
  assert.match(
    result.printed,
    new RegExp(`^${API_HOSTS.railway.credentialVariable}=\\*\\*\\*$`, 'm'),
  );
});

// VEN-633 AC1: a build failure — the step most likely to fail — leaves the
// migration and the API deploy never invoked, because web-build now runs
// before either of them.
test('dry run: a failed vercel build leaves migrate and api never invoked', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, fail: 'vercel@59.17.0 build' });

  assert.equal(result.failedAt, 'Release');
  assert.ok(!result.invocations.includes('pnpm db:migrate'), result.invocations.join('\n'));
  assert.ok(
    !result.invocations.some((line) => line.startsWith('npx --yes @railway')),
    result.invocations.join('\n'),
  );
  assertNoSecretPrinted(result.printed);
});

test('dry run: a failed migration aborts before the api or the web deploy, after the web is already built', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, fail: 'db:migrate' });

  assert.equal(result.failedAt, 'Release');
  assert.equal(result.invocations.at(-1), 'pnpm db:migrate');
  assert.ok(
    !result.invocations.some((line) => line.startsWith('npx --yes @railway')),
    result.invocations.join('\n'),
  );
  assert.equal(
    result.invocations.filter((line) => line === 'npx --yes vercel@59.17.0').length,
    2,
    result.invocations.join('\n'),
  );
  assertNoSecretPrinted(result.printed);
});

test('dry run: an unverified sender stops the release before the web is built or anything is migrated or deployed', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, fail: 'release:sender' });

  assert.equal(result.failedAt, 'Release');
  assert.equal(result.invocations.at(-1), 'pnpm release:sender');
  assert.match(result.printed, /::error::pnpm release:sender exited with 1/);
  assertNoSecretPrinted(result.printed);
  // Handed to the check, and redacted from its output like every other credential.
  assert.match(result.printed, new RegExp(`^${RESEND_KEY}=\\*\\*\\*$`, 'm'));
});

test('dry run: a readiness poll that fails fails the release', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, fail: 'smoke' });

  assert.equal(result.failedAt, 'Release');
  assertNoSecretPrinted(result.printed);
});

test('dry run: the API naming this release while the web names another fails, naming both', () => {
  const stale = 'b'.repeat(40);
  const result = dryRun({ secrets: SECRETS, vars: VARS, webCommit: stale });

  assert.equal(result.failedAt, 'Release');
  assert.ok(
    result.printed.includes(
      `Web/API skew: the web serves ${stale.slice(0, 7)} but the API serves ${SHA.slice(0, 7)}.`,
    ),
    result.printed,
  );
});

test('dry run: the web naming the same release as the API passes the gate', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS });

  assert.equal(result.failedAt, null);
  assert.ok(result.printed.includes(`web /api/ready names ${SHA.slice(0, 7)}`), result.printed);
});

test('ready: a web still on the previous build is polled again until it names this release', async () => {
  const { io } = recordingIo();
  const answers = ['b'.repeat(40), SHA];
  let asked = 0;
  let clock = 0;
  const healthy = coreFlowsFetch();
  io.fetch = async (url) => {
    const { pathname } = new URL(url);
    if (pathname === '/api/ready') {
      return Response.json({ commit: answers[asked++], runtimeEnv: RUNTIME_ENV_PRESENT });
    }
    return healthy(url);
  };
  io.now = () => clock;
  io.sleep = async (ms) => {
    clock += ms;
  };

  await PHASES.ready(
    {
      PATH: '/bin',
      API_URL: 'https://api.orla.test',
      WEB_URL: 'https://orla.test',
      NEON_AUTH_BASE_URL: NEON_AUTH.production,
      SENTRY_RELEASE: SHA,
    },
    io,
  );

  assert.equal(asked, 2);
  assert.equal(clock, 5_000);
});

test('ready: naming the right commit is not enough — a missing runtime variable still fails it, by name and never by value', async () => {
  const { io } = recordingIo();
  io.fetch = coreFlowsFetch({
    runtimeEnv: { ...RUNTIME_ENV_PRESENT, NEON_AUTH_BASE_URL: false, WEB_TIER_KEY: false },
  });
  io.sleep = async () => {
    throw new Error('must not retry a runtime-variable failure');
  };

  await assert.rejects(
    PHASES.ready(
      {
        PATH: '/bin',
        API_URL: 'https://api.orla.test',
        WEB_URL: 'https://orla.test',
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
        SENTRY_RELEASE: SHA,
      },
      io,
    ),
    (error) => {
      assert.match(error.message, /missing NEON_AUTH_BASE_URL, WEB_TIER_KEY at runtime/);
      assert.ok(!error.message.includes('true'), error.message);
      return true;
    },
  );
});

// VEN-632 AC4: a web still on the build from before this ticket reports no
// `runtimeEnv` key at all, not one that is `false`. Absent must read as
// "unknown", or this gate would refuse every release until every web in the
// fleet had redeployed — the failure that matters today is the one
// `webServesCoreFlows` finds, not a check this old build predates.
test('ready: a web with no runtimeEnv key at all is not held to the variable check — the failure falls through to webServesCoreFlows', async () => {
  const { io } = recordingIo();
  io.fetch = async (url) => {
    const { pathname } = new URL(url);
    if (pathname === '/api/ready') {
      return Response.json({ commit: SHA });
    }
    if (pathname === '/api/auth/get-session') {
      return new Response('', { status: 500 });
    }
    return coreFlowsFetch()(url);
  };

  await assert.rejects(
    PHASES.ready(
      {
        PATH: '/bin',
        API_URL: 'https://api.orla.test',
        WEB_URL: 'https://orla.test',
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
        SENTRY_RELEASE: SHA,
        SMOKE_DEADLINE_MS: '0',
      },
      io,
    ),
    { message: 'web auth answered HTTP 500' },
  );
});

test('webServesCoreFlows: any 5xx from get-session fails the release by status, not by echoing the body', async () => {
  const { io } = recordingIo();
  io.fetch = async (url) => {
    const { pathname } = new URL(url);
    if (pathname === '/api/auth/get-session') {
      return new Response('{"secret":"leak-me-not"}', { status: 500 });
    }
    return coreFlowsFetch()(url);
  };
  io.sleep = async () => {
    throw new Error('must not retry a hard failure before the deadline check runs once');
  };

  await assert.rejects(
    PHASES.ready(
      {
        PATH: '/bin',
        API_URL: 'https://api.orla.test',
        WEB_URL: 'https://orla.test',
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
        SENTRY_RELEASE: SHA,
        SMOKE_DEADLINE_MS: '0',
      },
      io,
    ),
    { message: 'web auth answered HTTP 500' },
  );
});

test('webServesCoreFlows: a 200 with an HTML session body fails, because JSON was required', async () => {
  const { io } = recordingIo();
  io.fetch = async (url) => {
    const { pathname } = new URL(url);
    if (pathname === '/api/auth/get-session') {
      return new Response('<html>not json</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
    return coreFlowsFetch()(url);
  };

  await assert.rejects(
    PHASES.ready(
      {
        PATH: '/bin',
        API_URL: 'https://api.orla.test',
        WEB_URL: 'https://orla.test',
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
        SENTRY_RELEASE: SHA,
        SMOKE_DEADLINE_MS: '0',
      },
      io,
    ),
    { message: 'web auth answered a non-JSON content-type (text/html)' },
  );
});

test('webServesCoreFlows: /sign-in without the form marker fails, even at 200', async () => {
  const { io } = recordingIo();
  io.fetch = async (url) => {
    const { pathname } = new URL(url);
    if (pathname === '/sign-in') {
      return new Response('<html><body>loading…</body></html>', { status: 200 });
    }
    return coreFlowsFetch()(url);
  };

  await assert.rejects(
    PHASES.ready(
      {
        PATH: '/bin',
        API_URL: 'https://api.orla.test',
        WEB_URL: 'https://orla.test',
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
        SENTRY_RELEASE: SHA,
        SMOKE_DEADLINE_MS: '0',
      },
      io,
    ),
    { message: 'web sign-in did not render the sign-in form' },
  );
});

/*
 * Mutation check (VEN-632 AC2): `SIGN_IN_MARKER` is compared against
 * `SIGN_IN_HTML`'s real markup, not a needle borrowed from the implementation.
 * Changing `SIGN_IN_MARKER` in `deploy.mjs` to anything not present in that
 * fixture makes this test fail — proving the guard reads the real value.
 */
test('webServesCoreFlows: passes on a healthy session, a rendered sign-in form and a 200 home page', async () => {
  const { io } = recordingIo();
  io.fetch = coreFlowsFetch();

  await PHASES.ready(
    {
      PATH: '/bin',
      API_URL: 'https://api.orla.test',
      WEB_URL: 'https://orla.test',
      NEON_AUTH_BASE_URL: NEON_AUTH.production,
      SENTRY_RELEASE: SHA,
    },
    io,
  );
});

test('ready: a web that never answers fails the release by name once the deadline passes', async () => {
  const { io } = recordingIo();
  let clock = 0;
  io.fetch = async () => {
    throw new Error('offline');
  };
  io.now = () => clock;
  io.sleep = async (ms) => {
    clock += ms;
  };

  await assert.rejects(
    PHASES.ready(
      {
        PATH: '/bin',
        API_URL: 'https://api.orla.test',
        WEB_URL: 'https://orla.test,https://www.orla.test',
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
        SENTRY_RELEASE: SHA,
        SMOKE_DEADLINE_MS: '20000',
      },
      io,
    ),
    { message: `The web's /api/ready never named ${SHA.slice(0, 7)} (did not answer).` },
  );
});

// The install-and-build step is plumbing, not a phase: it always runs, since
// only the Release step's own gate phase — the last thing that runs — knows
// whether this commit should deploy at all.
const INSTALL_INVOCATIONS = ['pnpm install --frozen-lockfile', 'pnpm turbo run'];

test('dry run: a staging push with nothing configured fails red naming every input', () => {
  const result = dryRun({ secrets: {}, vars: {}, branch: 'staging' });

  assert.equal(result.failedAt, 'Release');
  assert.deepEqual(result.invocations, [...INSTALL_INVOCATIONS, 'git ls-remote origin']);
  assert.match(result.printed, /not fully configured/);
  for (const { name, kind } of REQUIRED_INPUTS) {
    assert.ok(result.printed.includes(`${name} (${kind})`), name);
  }
});

test('dry run: a partly configured deploy fails closed before touching anything past the install', () => {
  const { DATABASE_URL_UNPOOLED: _dropped, ...secrets } = SECRETS;
  const result = dryRun({ secrets, vars: VARS });

  assert.equal(result.failedAt, 'Release');
  assert.deepEqual(result.invocations, [...INSTALL_INVOCATIONS, 'git ls-remote origin']);
  assert.match(result.printed, /DATABASE_URL_UNPOOLED \(secret\)/);
});

test('dry run: a superseded commit deploys nothing and does not fail', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, tip: 'f'.repeat(40) });

  assert.equal(result.failedAt, null);
  assert.deepEqual(result.ran, ['Install and build the release tooling', 'Release']);
  assert.deepEqual(result.invocations, [...INSTALL_INVOCATIONS, 'git ls-remote origin']);
});

test("dry run: a staging push builds the web, migrates staging first, then deploys, and looks up staging's tip", () => {
  const result = dryRun({
    secrets: SECRETS,
    vars: {
      ...VARS,
      NEON_BRANCH: 'staging',
      WEB_URL: 'https://orla-staging.test',
      NEON_AUTH_BASE_URL: NEON_AUTH.staging,
    },
    branch: 'staging',
  });

  assert.equal(result.failedAt, null, result.printed);
  assert.match(result.printed, /Deploying a1b2c3d to staging\./);
  assert.deepEqual(result.invocations.slice(0, 4), [
    ...INSTALL_INVOCATIONS,
    'git ls-remote origin',
    'pnpm release:sender',
  ]);
  assert.ok(
    result.invocations.indexOf('npx --yes vercel@59.17.0') <
      result.invocations.indexOf('pnpm db:migrate'),
    'the web is built before the migration',
  );
  assert.ok(
    result.invocations.indexOf('pnpm db:migrate') <
      result.invocations.indexOf('npx --yes @railway/cli@5.57.2'),
  );
  assert.equal(result.invocations.at(-1), 'pnpm smoke');
  assertNoSecretPrinted(result.printed);
});

/*
 * VEN-660 moved this refusal earlier: preflight holds NEON_BRANCH to the
 * target before it asks Neon anything, so it refuses before the web is built. `migrate`'s own NEON_BRANCH check still stands
 * behind it, and its unit tests above drive it directly.
 */
test("dry run: staging run handed production's Neon branch refuses at preflight, before anything is built, migrated or deployed", () => {
  const result = dryRun({
    secrets: SECRETS,
    vars: { ...VARS, WEB_URL: 'https://orla-staging.test' },
    branch: 'staging',
  });

  assert.equal(result.failedAt, 'Release');
  assert.match(
    result.printed,
    /NEON_BRANCH "production" is not the staging environment's Neon branch; refusing to release\./,
  );
  assert.ok(
    !result.invocations.some((line) => line.startsWith('npx') || line.startsWith('pnpm db:')),
    result.invocations.join('\n'),
  );
  assertNoSecretPrinted(result.printed);
});

test('dry run: a run for main is refused at the gate and touches nothing past the install', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, branch: 'main' });

  assert.equal(result.failedAt, 'Release');
  assert.deepEqual(result.invocations, INSTALL_INVOCATIONS);
  assert.match(result.printed, /CI ran on "main", which is not one of staging, production/);
});

test('web-build then web-deploy: staging builds under a branch, deploys a preview, and aliases it to the staging host', async () => {
  const calls = [];
  const url = 'https://orla-abc123-team.vercel.app';
  const io = {
    run: async (command, args, options) => {
      calls.push(command === 'npx' ? args.slice(2).join(' ') : `${command} ${args.join(' ')}`);
      if (args[2] === 'deploy') {
        // Progress lines can follow the URL: it is the last line that is one, not the last line.
        options.write(`Inspect: https://vercel.com/x\n${url}\nPreview: ${url} [3s]\n`);
      }
    },
    write: () => {},
  };
  const env = {
    PATH: '/bin',
    DEPLOY_TARGET: 'staging',
    VERCEL_TOKEN: fake('vercel'),
    VERCEL_ORG_ID: 'org',
    VERCEL_PROJECT_ID: 'prj',
    SENTRY_AUTH_TOKEN: fake('sentry'),
    ...BUILD_SECRETS,
    SENTRY_WEB_PROJECT: 'orla-web',
    SENTRY_RELEASE: SHA,
    // An allow-list: the first entry is the alias host.
    WEB_URL: 'https://orla-staging.vercel.app,https://staging.orla.test',
    NEON_AUTH_BASE_URL: NEON_AUTH.production,
    API_URL: 'https://api.orla.test',
  };
  await PHASES['web-build'](env, io);
  await PHASES['web-deploy'](env, io);

  assert.deepEqual(calls, [
    'git checkout -B staging',
    'pull --yes --environment=preview --git-branch=staging',
    'build',
    `deploy --prebuilt --env SENTRY_RELEASE=${SHA} --env NEON_AUTH_BASE_URL=${NEON_AUTH.production}`,
    `alias set ${url} orla-staging.vercel.app`,
  ]);
});

test('web-build: staging refuses to alias a host that is not its own, before building anything', async () => {
  const { io, calls } = recordingIo();
  for (const WEB_URL of ['https://orla.example', 'orla-staging.vercel.app', '']) {
    await assert.rejects(
      PHASES['web-build'](
        {
          DEPLOY_TARGET: 'staging',
          VERCEL_TOKEN: fake('vercel'),
          VERCEL_ORG_ID: 'org',
          VERCEL_PROJECT_ID: 'prj',
          SENTRY_AUTH_TOKEN: fake('sentry'),
          ...BUILD_SECRETS,
          SENTRY_WEB_PROJECT: 'orla-web',
          SENTRY_RELEASE: SHA,
          API_URL: 'https://api.orla.test',
          WEB_URL,
          NEON_AUTH_BASE_URL: NEON_AUTH.production,
        },
        io,
      ),
      /WEB_URL/,
    );
  }
  assert.equal(calls.length, 0);
});

test('web-build then web-deploy: production stays a production deployment, promoted and not aliased', async () => {
  const { io, calls } = recordingIo();
  const env = {
    PATH: '/bin',
    DEPLOY_TARGET: 'production',
    VERCEL_TOKEN: fake('vercel'),
    VERCEL_ORG_ID: 'org',
    VERCEL_PROJECT_ID: 'prj',
    SENTRY_AUTH_TOKEN: fake('sentry'),
    ...BUILD_SECRETS,
    SENTRY_WEB_PROJECT: 'orla-web',
    SENTRY_RELEASE: SHA,
    WEB_URL: 'https://orla.test',
    NEON_AUTH_BASE_URL: NEON_AUTH.production,
    API_URL: 'https://api.orla.test',
  };
  await PHASES['web-build'](env, io);
  await PHASES['web-deploy'](env, io);

  assert.deepEqual(
    calls.map(({ args }) => args.slice(2).join(' ')),
    [
      'pull --yes --environment=production',
      'build --prod',
      `deploy --prebuilt --prod --env SENTRY_RELEASE=${SHA} --env NEON_AUTH_BASE_URL=${NEON_AUTH.production}`,
      `promote ${DEPLOY_URL}`,
    ],
  );
  assert.ok(
    !calls.some((call) => call.command === 'git'),
    'production never checks out a branch; --prod is unambiguous already',
  );
});

for (const target of ['staging', 'production']) {
  test(`web-build: ${target} sets DEPLOYMENT_ORIGIN to WEB_URL's canonical origin on vercel build`, async () => {
    const { io, calls } = recordingIo();
    await PHASES['web-build'](
      {
        PATH: '/bin',
        DEPLOY_TARGET: target,
        VERCEL_TOKEN: fake('vercel'),
        VERCEL_ORG_ID: 'org',
        VERCEL_PROJECT_ID: 'prj',
        SENTRY_AUTH_TOKEN: fake('sentry'),
        SENTRY_WEB_PROJECT: 'orla-web',
        SENTRY_RELEASE: SHA,
        WEB_URL: 'https://orla-staging.vercel.app/,https://staging.orla.test',
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
        API_URL: 'https://api.orla.test',
        ...BUILD_SECRETS,
      },
      io,
    );

    for (const call of calls) {
      const isBuild = call.args[2] === 'build';
      assert.equal(
        call.env.DEPLOYMENT_ORIGIN,
        isBuild ? 'https://orla-staging.vercel.app' : undefined,
        `${call.args[2]} DEPLOYMENT_ORIGIN`,
      );
    }
  });

  test(`web-build: ${target} sets API_URL and NEXT_PUBLIC_API_URL to the environment's API_URL on vercel build`, async () => {
    const { io, calls } = recordingIo();
    await PHASES['web-build'](
      {
        PATH: '/bin',
        DEPLOY_TARGET: target,
        VERCEL_TOKEN: fake('vercel'),
        VERCEL_ORG_ID: 'org',
        VERCEL_PROJECT_ID: 'prj',
        SENTRY_AUTH_TOKEN: fake('sentry'),
        SENTRY_WEB_PROJECT: 'orla-web',
        SENTRY_RELEASE: SHA,
        WEB_URL: 'https://orla-staging.vercel.app',
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
        API_URL: 'https://api.orla.test',
        ...BUILD_SECRETS,
      },
      io,
    );

    for (const call of calls) {
      const isBuild = call.args[2] === 'build';
      assert.equal(
        call.env.API_URL,
        isBuild ? 'https://api.orla.test' : undefined,
        `${call.args[2]} API_URL`,
      );
      assert.equal(
        call.env.NEXT_PUBLIC_API_URL,
        isBuild ? 'https://api.orla.test' : undefined,
        `${call.args[2]} NEXT_PUBLIC_API_URL`,
      );
    }
  });

  test(`web-build: ${target} refuses before running anything when API_URL is missing`, async () => {
    const { io, calls } = recordingIo();
    await assert.rejects(
      PHASES['web-build'](
        {
          DEPLOY_TARGET: target,
          VERCEL_TOKEN: fake('vercel'),
          VERCEL_ORG_ID: 'org',
          VERCEL_PROJECT_ID: 'prj',
          SENTRY_AUTH_TOKEN: fake('sentry'),
          SENTRY_WEB_PROJECT: 'orla-web',
          SENTRY_RELEASE: SHA,
          WEB_URL: 'https://orla-staging.vercel.app',
          NEON_AUTH_BASE_URL: NEON_AUTH.production,
          API_URL: '',
          ...BUILD_SECRETS,
        },
        io,
      ),
      /API_URL/,
    );
    assert.equal(calls.length, 0);
  });

  test(`web-build: ${target} hands the two build secrets to vercel build only, never argv`, async () => {
    const { io, calls } = recordingIo();
    await PHASES['web-build'](
      {
        PATH: '/bin',
        DEPLOY_TARGET: target,
        VERCEL_TOKEN: fake('vercel'),
        VERCEL_ORG_ID: 'org',
        VERCEL_PROJECT_ID: 'prj',
        SENTRY_AUTH_TOKEN: fake('sentry'),
        SENTRY_WEB_PROJECT: 'orla-web',
        SENTRY_RELEASE: SHA,
        WEB_URL: 'https://orla-staging.vercel.app',
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
        API_URL: 'https://api.orla.test',
        ...BUILD_SECRETS,
      },
      io,
    );

    for (const call of calls) {
      const isBuild = call.args[2] === 'build';
      for (const [name, value] of Object.entries(BUILD_SECRETS)) {
        assert.equal(call.env[name], isBuild ? value : undefined, `${call.args[2]} ${name}`);
        assert.ok(!call.args.some((arg) => arg.includes(value)), 'secret on a command line');
      }
    }
  });

  test(`web-build: ${target} refuses before running anything when a build secret is missing`, async () => {
    for (const missing of Object.keys(BUILD_SECRETS)) {
      const { io, calls } = recordingIo();
      await assert.rejects(
        PHASES['web-build'](
          {
            DEPLOY_TARGET: target,
            VERCEL_TOKEN: fake('vercel'),
            VERCEL_ORG_ID: 'org',
            VERCEL_PROJECT_ID: 'prj',
            SENTRY_AUTH_TOKEN: fake('sentry'),
            SENTRY_WEB_PROJECT: 'orla-web',
            SENTRY_RELEASE: SHA,
            WEB_URL: 'https://orla-staging.vercel.app',
            NEON_AUTH_BASE_URL: NEON_AUTH.production,
            API_URL: 'https://api.orla.test',
            ...BUILD_SECRETS,
            [missing]: '',
          },
          io,
        ),
        new RegExp(missing),
      );
      assert.equal(calls.length, 0);
    }
  });
}

test('preflight: a missing build secret fails naming it, before migrate', async () => {
  for (const name of Object.keys(BUILD_SECRETS)) {
    await assert.rejects(
      PHASES.preflight({ ...allPresent(), [presenceFlag(name)]: 'false' }, recordingIo().io),
      new RegExp(`missing: ${name} \\(secret\\)`),
    );
  }
});

test('dry run: the build secrets reach vercel build and never the log or the other vercel steps', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS });
  assert.equal(result.failedAt, null, result.printed);
  for (const value of Object.values(BUILD_SECRETS)) {
    assert.ok(!result.printed.includes(value), 'printed a build secret');
  }
});

// --- VEN-634: rollback, redeploy and the release that stops partway ------------------

/*
 * AC1. A rolled-back production project has auto-assign off: `deploy --prod`
 * creates the deployment but leaves the domain where it was, and only
 * `promote` moves it. This fake Vercel says exactly that, so the phase can only
 * pass by promoting.
 */
test('web-deploy: after a rollback turned auto-assign off, the production domain still ends up on the new deployment', async () => {
  const domain = { target: 'https://orla-rolled-back.vercel.app' };
  const io = {
    run: async (command, args, options) => {
      const verb = args[2];
      if (verb === 'deploy') {
        options.write(`Production: ${DEPLOY_URL} [3s]\n${DEPLOY_URL}\n`);
      }
      if (verb === 'promote') {
        domain.target = args[3];
      }
    },
    write: () => {},
  };

  await PHASES['web-deploy'](
    {
      PATH: '/bin',
      DEPLOY_TARGET: 'production',
      VERCEL_TOKEN: fake('vercel'),
      VERCEL_ORG_ID: 'org',
      VERCEL_PROJECT_ID: 'prj',
      SENTRY_RELEASE: SHA,
      WEB_URL: 'https://orla.test',
      NEON_AUTH_BASE_URL: NEON_AUTH.production,
    },
    io,
  );

  assert.equal(domain.target, DEPLOY_URL);
});

test('web-deploy: production without a printed deployment URL fails naming what it could not promote', async () => {
  const io = { run: async () => {}, write: () => {} };

  await assert.rejects(
    PHASES['web-deploy'](
      {
        PATH: '/bin',
        DEPLOY_TARGET: 'production',
        VERCEL_TOKEN: fake('vercel'),
        VERCEL_ORG_ID: 'org',
        VERCEL_PROJECT_ID: 'prj',
        SENTRY_RELEASE: SHA,
        WEB_URL: 'https://orla.test',
        NEON_AUTH_BASE_URL: NEON_AUTH.production,
      },
      io,
    ),
    /did not print a deployment URL to promote/,
  );
});

test('gate: a manual release of a commit that is not the tip fails, where a superseded CI run only warns', () => {
  const base = { conclusion: 'success', event: 'push', branch: 'staging', headSha: SHA };
  const tipSha = 'f'.repeat(40);

  assert.deepEqual(gateVerdict({ ...base, tipSha, manual: false }).fail, false);
  const manual = gateVerdict({ ...base, tipSha, manual: true });
  assert.equal(manual.deploy, false);
  assert.equal(manual.fail, true);
  assert.match(manual.message, /a1b2c3d is not staging's tip \(fffffff\)/);
});

test('release: a web deploy that fails after the API succeeded names both commits and the runbook step, and never polls ready', async () => {
  const NEW = SHA;
  const OLD = '0123456789abcdef0123456789abcdef01234567';
  const order = [];

  await withStubbedPhases(
    RELEASE_PHASES,
    (name) => async () => {
      order.push(name);
      if (name === 'gate') {
        return { deploy: true };
      }
      if (name === 'web-deploy') {
        throw new PhaseError('npx vercel deploy exited with 1');
      }
    },
    async () => {
      const { io } = recordingIo();
      io.fetch = coreFlowsFetch({ commit: OLD });

      await assert.rejects(
        PHASES.release({ SENTRY_RELEASE: NEW, WEB_URL: 'https://orla.test' }, io),
        (error) => {
          assert.ok(error instanceof PhaseError);
          assert.match(error.message, /npx vercel deploy exited with 1/);
          assert.ok(error.message.includes(`API is already live on ${NEW.slice(0, 7)}`));
          assert.ok(error.message.includes(`web still serves ${OLD.slice(0, 7)}`));
          assert.ok(error.message.includes(`"${SKEW_RUNBOOK_STEP}" in docs/runbook-rollback.md`));
          return true;
        },
      );
    },
  );

  assert.equal(order.at(-1), 'web-deploy');
  assert.ok(!order.includes('ready'));
});

test('release: a web that answers nothing is still named as the unknown side of the skew', async () => {
  await withStubbedPhases(
    RELEASE_PHASES,
    (name) => async () => {
      if (name === 'gate') {
        return { deploy: true };
      }
      if (name === 'web-deploy') {
        throw new Error('boom with a value that must not be printed');
      }
    },
    async () => {
      const { io } = recordingIo();
      io.fetch = async () => {
        throw new Error('offline');
      };

      await assert.rejects(
        PHASES.release({ SENTRY_RELEASE: SHA, WEB_URL: 'https://orla.test' }, io),
        (error) => {
          assert.match(error.message, /^web-deploy failed unexpectedly\./);
          assert.ok(!error.message.includes('must not be printed'));
          assert.match(error.message, /web still serves a commit its \/api\/ready did not name/);
          return true;
        },
      );
    },
  );
});

test('runbook: has the step a partial release sends a person to, the staging rollback, and the redeploy', () => {
  const runbook = readFileSync(path.join(ROOT, 'docs/runbook-rollback.md'), 'utf8');

  assert.match(runbook, new RegExp(`^## .*${SKEW_RUNBOOK_STEP}`, 'm'));
  assert.match(runbook, /vercel alias set <previous-deployment-url> <staging-host>/);
  assert.match(runbook, /vercel promote <deployment-url>/);
  assert.match(runbook, /^## .*[Rr]edeploy the same commit/m);
});

test('workflow: a manual release takes an environment and a sha, and nothing else', () => {
  const { inputs } = WORKFLOW.on.workflow_dispatch;

  assert.deepEqual(Object.keys(inputs).sort(), ['environment', 'sha']);
  assert.equal(inputs.environment.type, 'choice');
  assert.deepEqual(inputs.environment.options, ['staging', 'production']);
  assert.equal(inputs.environment.required, true);
  assert.equal(inputs.sha.required, true);
  // Reading CI's conclusion is the only thing the token gains over read-only contents.
  assert.deepEqual(WORKFLOW.permissions, { contents: 'read', actions: 'read' });
});

test('dry run: a manual release of the production tip asks CI, then deploys and promotes', () => {
  const result = dryRun({
    secrets: SECRETS,
    vars: VARS,
    dispatch: { environment: 'production', sha: SHA },
  });

  assert.equal(result.failedAt, null, result.printed);
  assert.deepEqual(result.invocations.slice(0, 5), [
    'pnpm install --frozen-lockfile',
    'pnpm turbo run',
    'git ls-remote origin',
    'gh run list',
    'pnpm release:sender',
  ]);
  assert.equal(result.invocations.at(-1), 'pnpm smoke');
  assert.match(result.printed, /Deploying a1b2c3d to production/);
});

test('dry run: a manual release still refuses a sha that is not the branch tip, before anything else runs', () => {
  const result = dryRun({
    secrets: SECRETS,
    vars: VARS,
    tip: 'f'.repeat(40),
    dispatch: { environment: 'production', sha: SHA },
  });

  assert.equal(result.failedAt, 'Release');
  assert.match(result.printed, /a1b2c3d is not production's tip \(fffffff\)/);
  assert.ok(!result.invocations.includes('pnpm release:sender'));
  assert.ok(!result.invocations.includes('pnpm db:migrate'));
});

for (const ci of ['failure', '']) {
  test(`dry run: a manual release of a commit whose CI concluded ${JSON.stringify(ci)} is refused`, () => {
    const result = dryRun({
      secrets: SECRETS,
      vars: VARS,
      ci,
      dispatch: { environment: 'production', sha: SHA },
    });

    assert.equal(result.failedAt, 'Release');
    assert.match(result.printed, /CI concluded ".*", which is not success; not deploying/);
    assert.ok(!result.invocations.includes('pnpm release:sender'));
  });
}
