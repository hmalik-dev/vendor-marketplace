/**
 * VEN-397. The deploy's phases, and a dry run of `.github/workflows/deploy.yml`
 * itself: its steps are executed in order, the way Actions executes them, with
 * `git`, `pnpm` and `npx` replaced by stubs that record what they were asked to
 * do. That is what "tested, not assumed" means here without a production
 * account: the order, the abort on a failed migration, the failed poll, the
 * refusal to start unconfigured, and no secret in any log. Runs under plain
 * `node` via `pnpm test:agents`.
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
  REQUIRED_INPUTS,
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

function recordingIo() {
  const calls = [];
  const lines = [];
  return {
    calls,
    lines,
    io: {
      run: async (command, args, options) => {
        calls.push({ command, args, env: options.env });
      },
      write: (text) => lines.push(text),
      error: (text) => lines.push(text),
    },
  };
}

// --- gate -------------------------------------------------------------------

test('gate: a successful push CI run for the tip of main deploys', () => {
  assert.deepEqual(
    gateVerdict({ conclusion: 'success', event: 'push', headSha: SHA, tipSha: SHA }),
    { deploy: true, fail: false, message: 'Deploying a1b2c3d.' },
  );
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
    const verdict = gateVerdict({ conclusion, event: 'push', headSha: SHA, tipSha: SHA });
    assert.deepEqual([verdict.deploy, verdict.fail], [false, true], String(conclusion));
  }
});

test('gate: a pull request CI run never deploys', () => {
  const verdict = gateVerdict({
    conclusion: 'success',
    event: 'pull_request',
    headSha: SHA,
    tipSha: SHA,
  });
  assert.deepEqual([verdict.deploy, verdict.fail], [false, true]);
});

test('gate: a superseded commit does not deploy over a newer one, and does not fail', () => {
  const verdict = gateVerdict({
    conclusion: 'success',
    event: 'push',
    headSha: SHA,
    tipSha: 'f'.repeat(40),
  });
  assert.deepEqual([verdict.deploy, verdict.fail], [false, false]);
  assert.match(verdict.message, /no longer main's tip/);
});

// --- preflight --------------------------------------------------------------

function allPresent() {
  return {
    ...Object.fromEntries(REQUIRED_INPUTS.map(({ name }) => [presenceFlag(name), 'true'])),
    API_HOST: 'railway',
  };
}

test('preflight: unconfigured, it fails naming every missing input and where it is set', async () => {
  const { io } = recordingIo();
  await assert.rejects(PHASES.preflight({}, io), (error) => {
    for (const { name, kind } of REQUIRED_INPUTS) {
      assert.ok(error.message.includes(`${name} (${kind})`), name);
    }
    assert.match(error.message, /VEN-377/);
    return true;
  });
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

// --- migrate ----------------------------------------------------------------

test('migrate: refuses to run without the unpooled URL', async () => {
  const { io, calls } = recordingIo();
  await assert.rejects(PHASES.migrate({ PATH: '/bin' }, io), /Missing DATABASE_URL_UNPOOLED/);
  assert.equal(calls.length, 0);
});

test('migrate: refuses a step that was also handed the pooled URL', async () => {
  const { io, calls } = recordingIo();
  await assert.rejects(
    PHASES.migrate(
      { DATABASE_URL_UNPOOLED: UNPOOLED, DATABASE_URL: 'postgresql://pooled.example/orla' },
      io,
    ),
    /migrations take DATABASE_URL_UNPOOLED only/,
  );
  assert.equal(calls.length, 0);
});

test('migrate: migrations receive only DATABASE_URL_UNPOOLED, then the reference seed runs over it', async () => {
  const { io, calls } = recordingIo();
  const unrelated = { VERCEL_TOKEN: fake('vercel') };
  await PHASES.migrate({ PATH: '/bin', DATABASE_URL_UNPOOLED: UNPOOLED, ...unrelated }, io);

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
      ...credentials,
    },
    io,
  );

  assert.deepEqual(
    calls.map(({ args }) => args.slice(2).join(' ')),
    [
      `variables --service orla-api --set SENTRY_RELEASE=${SHA} --skip-deploys`,
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
    PHASES.api({ API_HOST: 'render', API_SERVICE: 's', SENTRY_RELEASE: SHA, ...credentials }, io),
    /no adapter/,
  );
  assert.equal(calls.length, 0);
});

test('web: builds under the release and upload credential, and deploys without the upload credential', async () => {
  const { io, calls } = recordingIo();
  const credentials = { VERCEL_TOKEN: fake('vercel'), SENTRY_AUTH_TOKEN: fake('sentry') };
  await PHASES.web(
    {
      PATH: '/bin',
      VERCEL_ORG_ID: 'org',
      VERCEL_PROJECT_ID: 'prj',
      SENTRY_WEB_PROJECT: 'orla-web',
      SENTRY_RELEASE: SHA,
      DATABASE_URL_UNPOOLED: UNPOOLED,
      ...credentials,
    },
    io,
  );

  assert.deepEqual(
    calls.map(({ args }) => args[2]),
    ['pull', 'build', 'deploy'],
  );
  assert.equal(calls[1].env.SENTRY_RELEASE, SHA);
  assert.equal(calls[1].env.SENTRY_AUTH_TOKEN, fake('sentry'));
  assert.equal(calls[2].env.SENTRY_AUTH_TOKEN, undefined);
  assert.ok(calls[2].args.includes(`SENTRY_RELEASE=${SHA}`));
  for (const call of calls) {
    assert.equal(call.env.DATABASE_URL_UNPOOLED, undefined);
  }
});

test('ready: polls through the smoke check for this release, with a bounded deadline', async () => {
  const { io, calls } = recordingIo();
  await PHASES.ready(
    {
      PATH: '/bin',
      API_URL: 'https://api.orla.test',
      WEB_URL: 'https://orla.test',
      SENTRY_RELEASE: SHA,
    },
    io,
  );

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
    env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL_UNPOOLED: UNPOOLED },
    encoding: 'utf8',
    timeout: 120_000,
  });
  const log = result.stdout + result.stderr;

  assert.equal(result.status, 1, log);
  assert.match(log, /pnpm db:migrate exited with 1/);
  assert.match(log, /Migration failed/);
  assert.ok(!log.includes(new URL(UNPOOLED).password), log);
});

// --- the workflow file ----------------------------------------------------------

test('workflow: runs after CI completes on main, and CI is the workflow it names', () => {
  assert.equal(CI.name, 'CI');
  assert.deepEqual(WORKFLOW.on, {
    workflow_run: { workflows: ['CI'], types: ['completed'], branches: ['main'] },
  });
  assert.equal(
    JOB.if,
    "github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push'",
  );
});

test('workflow: serialises deploys and never cancels one in flight', () => {
  assert.deepEqual(WORKFLOW.concurrency, {
    group: 'deploy-production',
    'cancel-in-progress': false,
  });
  assert.equal(JOB.concurrency, undefined);
});

test('workflow: no step outlives a failure before it', () => {
  for (const step of JOB.steps) {
    assert.equal(step['continue-on-error'], undefined, step.name);
    assert.ok(
      step.if === undefined || step.if === "steps.gate.outputs.deploy == 'true'",
      `${step.name}: ${step.if}`,
    );
  }
});

/*
 * The step **id**, which the dry run cannot check for: it models each condition
 * by reading the file the gate wrote, where Actions evaluates
 * `steps.<id>.outputs.deploy`. So deleting `id: gate` — an edit that looks
 * redundant beside `name:` — left every test green while, on GitHub, the
 * reference would expand to empty, every guarded step would be skipped, and the
 * job would report success having deployed nothing. That is the one failure
 * this workflow exists to remove, so it is pinned here rather than simulated.
 */
test('workflow: the gate declares the id every later step is conditional on', () => {
  const [checkout, gate, ...rest] = JOB.steps;

  assert.equal(checkout.uses, 'actions/checkout@v4');
  assert.equal(gate.id, 'gate');
  assert.equal(gate.run, 'node scripts/deploy.mjs gate');
  assert.equal(gate.if, undefined);

  assert.ok(rest.length > 0);
  for (const step of rest) {
    assert.equal(step.if, `steps.${gate.id}.outputs.deploy == 'true'`, step.name ?? step.uses);
  }
});

test('workflow: only the migrate step is handed a database URL, and only the unpooled one', () => {
  const migrate = JOB.steps.find((step) => step.run === 'node scripts/deploy.mjs migrate');
  const holders = JOB.steps.filter((step) =>
    Object.values(step.env ?? {}).some((value) => /secrets\.DATABASE_URL[A-Z_]* \}\}/.test(value)),
  );

  assert.deepEqual(holders, [migrate]);
  assert.deepEqual(migrate.env, { DATABASE_URL_UNPOOLED: '${{ secrets.DATABASE_URL_UNPOOLED }}' });
  assert.ok(!Object.keys(JOB.env).some((key) => key.startsWith('DATABASE_URL')));
});

test('workflow: preflight is told exactly which inputs are set, and never a secret value', () => {
  const preflight = JOB.steps.find((step) => step.run === 'node scripts/deploy.mjs preflight');
  const flags = Object.entries(preflight.env).filter(([key]) => key.startsWith('HAS_'));

  assert.deepEqual(
    flags.map(([key]) => key).sort(),
    REQUIRED_INPUTS.map(({ name }) => presenceFlag(name)).sort(),
  );
  for (const [key, value] of flags) {
    assert.match(value, /^\$\{\{ (secrets|vars)\.[A-Z_]+ != '' \}\}$/, key);
  }
  assert.ok(!Object.values(preflight.env).some((value) => /secrets\.[A-Z_]+ \}\}/.test(value)));
});

test('workflow: the release the SDKs report is the commit CI tested', () => {
  assert.equal(JOB.env.SENTRY_RELEASE, '${{ github.event.workflow_run.head_sha }}');
  assert.equal(JOB.steps[0].with.ref, '${{ github.event.workflow_run.head_sha }}');
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
  "git ls-remote"*) printf '%s\\trefs/heads/main\\n' "$(cat "$here/tip")" ;;
  *) env ;;
esac
fail=$(cat "$here/fail")
if [ -n "$fail" ]; then
  case "$call" in *"$fail"*) echo "stub failure for $fail" >&2; exit 1 ;; esac
fi
exit 0
`;

/** GitHub's expression syntax, for exactly the forms this workflow uses; anything else throws. */
function expand(value, context) {
  return String(value).replace(/\$\{\{\s*(.+?)\s*\}\}/g, (_, expression) => {
    const presence = /^(secrets|vars)\.([A-Z_]+) != ''$/.exec(expression);
    if (presence) {
      return String(context[presence[1]][presence[2]] !== undefined);
    }
    const lookup = /^(secrets|vars)\.([A-Z_]+)$/.exec(expression);
    if (lookup) {
      return context[lookup[1]][lookup[2]] ?? '';
    }
    if (expression.startsWith('github.event.workflow_run.')) {
      return context.workflowRun[expression.slice('github.event.workflow_run.'.length)];
    }
    throw new Error(`unsupported expression: ${expression}`);
  });
}

/** Executes the job's `run` steps as Actions does: in order, stopping at the first failure. */
function dryRun({ secrets, vars, tip = SHA, fail = '' }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'deploy-dry-run-'));
  try {
    for (const tool of ['git', 'pnpm', 'npx']) {
      writeFileSync(path.join(dir, tool), STUB);
      chmodSync(path.join(dir, tool), 0o755);
    }
    const log = path.join(dir, 'invocations.log');
    const output = path.join(dir, 'github-output');
    writeFileSync(log, '');
    writeFileSync(output, '');
    writeFileSync(path.join(dir, 'tip'), tip);
    writeFileSync(path.join(dir, 'fail'), fail);

    const context = {
      secrets,
      vars,
      workflowRun: { conclusion: 'success', event: 'push', head_sha: SHA },
    };
    const printed = [];
    const ran = [];
    let failedAt = null;

    for (const step of JOB.steps) {
      // `uses:` steps set up tooling this host already has.
      if (step.uses) {
        continue;
      }
      // The only condition the workflow may use, asserted above.
      if (step.if !== undefined && !readFileSync(output, 'utf8').includes('deploy=true')) {
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
          PATH: `${dir}:${path.dirname(process.execPath)}:/usr/bin:/bin`,
          HOME: dir,
          GITHUB_OUTPUT: output,
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
  ['DATABASE_URL_UNPOOLED', 'API_HOST_TOKEN', 'VERCEL_TOKEN', 'SENTRY_AUTH_TOKEN'].map((name) => [
    name,
    name === 'DATABASE_URL_UNPOOLED' ? UNPOOLED : fake(name.toLowerCase()),
  ]),
);
const VARS = {
  API_HOST: 'railway',
  API_SERVICE: 'orla-api',
  VERCEL_ORG_ID: 'team_x',
  VERCEL_PROJECT_ID: 'prj_x',
  SENTRY_WEB_PROJECT: 'orla-web',
  API_URL: 'https://api.orla.test',
  WEB_URL: 'https://orla.test',
};

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

test('dry run: a configured release runs migrate → api → web → poll, in that order', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS });

  assert.equal(result.failedAt, null, result.printed);
  assert.deepEqual(result.invocations, [
    'git ls-remote origin',
    'pnpm install --frozen-lockfile',
    'pnpm turbo run',
    'pnpm db:migrate',
    'pnpm db:seed',
    'npx --yes @railway/cli@5.57.2',
    'npx --yes @railway/cli@5.57.2',
    'npx --yes vercel@59.17.0',
    'npx --yes vercel@59.17.0',
    'npx --yes vercel@59.17.0',
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

test('dry run: a failed migration aborts before either service is deployed', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, fail: 'db:migrate' });

  assert.equal(result.failedAt, 'Migrate, then seed reference data');
  assert.equal(result.invocations.at(-1), 'pnpm db:migrate');
  assert.ok(
    !result.invocations.some((line) => line.startsWith('npx')),
    result.invocations.join('\n'),
  );
  assertNoSecretPrinted(result.printed);
});

test('dry run: a readiness poll that fails fails the release', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, fail: 'smoke' });

  assert.equal(result.failedAt, 'Poll /ready until it names this release');
  assertNoSecretPrinted(result.printed);
});

test('dry run: with nothing configured the run fails closed before touching anything', () => {
  const result = dryRun({ secrets: {}, vars: {} });

  assert.equal(result.failedAt, 'Refuse to start unless every deploy input is configured');
  assert.deepEqual(result.invocations, ['git ls-remote origin']);
  assert.match(result.printed, /DATABASE_URL_UNPOOLED \(secret\)/);
});

test('dry run: a superseded commit deploys nothing and does not fail', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, tip: 'f'.repeat(40) });

  assert.equal(result.failedAt, null);
  assert.deepEqual(result.ran, ["Gate on CI success and on still being main's tip"]);
  assert.deepEqual(result.invocations, ['git ls-remote origin']);
});
