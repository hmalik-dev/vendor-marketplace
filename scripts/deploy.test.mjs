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
const GATED = "steps.gate.outputs.deploy == 'true'";
const READY = `${GATED} && steps.preflight.outputs.ready == 'true'`;
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

test('workflows: smoke is gated on its URL, ci and smoke read-only, every deploy action SHA-pinned', () => {
  const SMOKE = parse(readFileSync(path.join(ROOT, '.github/workflows/smoke.yml'), 'utf8'));
  assert.equal(SMOKE.jobs.smoke.if, "vars.SMOKE_API_URL != ''");
  assert.doesNotMatch(JSON.stringify(SMOKE), /railway\.app/);
  assert.deepEqual(SMOKE.permissions, { contents: 'read' });
  assert.deepEqual(CI.permissions, { contents: 'read' });
  for (const step of JOB.steps.filter((candidate) => candidate.uses)) {
    assert.match(step.uses, /^[\w./-]+@[0-9a-f]{40}$/, step.uses);
  }
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
      DEPLOY_TARGET: 'production',
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
  const asked = [];
  io.fetch = async (url) => {
    asked.push(url);
    return Response.json({ commit: SHA });
  };
  await PHASES.ready(
    {
      PATH: '/bin',
      API_URL: 'https://api.orla.test',
      WEB_URL: 'https://orla.test',
      SENTRY_RELEASE: SHA,
    },
    io,
  );

  assert.deepEqual(asked, ['https://orla.test/api/ready']);
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

// --- the workflow file ----------------------------------------------------------

test('workflow: runs after CI completes on staging or production only, never on main', () => {
  assert.equal(CI.name, 'CI');
  assert.deepEqual(WORKFLOW.on, {
    workflow_run: {
      workflows: ['CI'],
      types: ['completed'],
      branches: ['staging', 'production'],
    },
  });
  assert.ok(!JSON.stringify(WORKFLOW.on).includes('main'));
  // CI must run on the branches the deploy waits for, or it never fires.
  for (const branch of ['staging', 'production']) {
    assert.ok(CI.on.push.branches.includes(branch), branch);
  }
  assert.equal(
    JOB.if,
    "github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push' && (github.event.workflow_run.head_branch == 'staging' || github.event.workflow_run.head_branch == 'production')",
  );
});

test('workflow: the branch is the environment, so each has its own secrets and variables', () => {
  assert.equal(JOB.environment, '${{ github.event.workflow_run.head_branch }}');
  assert.equal(JOB.env.DEPLOY_TARGET, '${{ github.event.workflow_run.head_branch }}');
});

test('workflow: serialises deploys per environment and never cancels one in flight', () => {
  assert.deepEqual(WORKFLOW.concurrency, {
    // The head repository is in the key so a fork's branch of the same name cannot queue in front of a real deploy.
    group:
      'deploy-${{ github.event.workflow_run.head_repository.full_name }}-${{ github.event.workflow_run.head_branch }}',
    'cancel-in-progress': false,
  });
  assert.equal(JOB.concurrency, undefined);
});

test('workflow: no step outlives a failure before it', () => {
  for (const step of JOB.steps) {
    assert.equal(step['continue-on-error'], undefined, step.name);
    assert.ok(
      step.if === undefined || step.if === GATED || step.if === READY,
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

  assert.match(checkout.uses, /^actions\/checkout@[0-9a-f]{40}$/);
  assert.equal(gate.id, 'gate');
  assert.equal(gate.run, 'node scripts/deploy.mjs gate');
  assert.equal(gate.if, undefined);

  assert.ok(rest.length > 0);
  for (const step of rest) {
    const expected = step.id === 'preflight' ? GATED : READY;
    assert.equal(step.if, expected, step.name ?? step.uses);
  }
});

test('workflow: only the migrate step is handed a database URL, and only the unpooled one', () => {
  const migrate = JOB.steps.find((step) => step.run === 'node scripts/deploy.mjs migrate');
  const holders = JOB.steps.filter((step) =>
    Object.values(step.env ?? {}).some((value) => /secrets\.DATABASE_URL[A-Z_]* \}\}/.test(value)),
  );

  assert.deepEqual(holders, [migrate]);
  assert.deepEqual(migrate.env, {
    DATABASE_URL_UNPOOLED: '${{ secrets.DATABASE_URL_UNPOOLED }}',
    NEON_BRANCH: '${{ vars.NEON_BRANCH }}',
    NEON_HOST: '${{ vars.NEON_HOST }}',
  });
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
function dryRun({ secrets, vars, branch = 'production', tip = SHA, fail = '', webCommit = SHA }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'deploy-dry-run-'));
  try {
    // The web's `/api/ready` answer, for the one child that fetches it: node itself is not stubbed.
    writeFileSync(
      path.join(dir, 'web-fetch.mjs'),
      `globalThis.fetch = async () => Response.json({ commit: ${JSON.stringify(webCommit)} });\n`,
    );
    for (const tool of ['git', 'pnpm', 'npx']) {
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

    const context = {
      secrets,
      vars,
      workflowRun: { conclusion: 'success', event: 'push', head_sha: SHA, head_branch: branch },
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
      const written = step.if === undefined ? '' : readFileSync(output, 'utf8');
      const needed = step.if === READY ? ['deploy=true', 'ready=true'] : ['deploy=true'];
      if (step.if !== undefined && !needed.every((line) => written.includes(line))) {
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
  NEON_BRANCH: 'production',
  NEON_HOST: new URL(UNPOOLED).hostname,
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

test('dry run: the API naming this release while the web names another fails, naming both', () => {
  const stale = 'b'.repeat(40);
  const result = dryRun({ secrets: SECRETS, vars: VARS, webCommit: stale });

  assert.equal(result.failedAt, 'Poll /ready until it names this release');
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
  io.fetch = async () => Response.json({ commit: answers[asked++] });
  io.now = () => clock;
  io.sleep = async (ms) => {
    clock += ms;
  };

  await PHASES.ready(
    {
      PATH: '/bin',
      API_URL: 'https://api.orla.test',
      WEB_URL: 'https://orla.test',
      SENTRY_RELEASE: SHA,
    },
    io,
  );

  assert.equal(asked, 2);
  assert.equal(clock, 5_000);
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
        SENTRY_RELEASE: SHA,
        SMOKE_DEADLINE_MS: '20000',
      },
      io,
    ),
    { message: `The web's /api/ready never named ${SHA.slice(0, 7)} (did not answer).` },
  );
});

const GATE_STEP = "Gate on CI success and on still being the branch's tip";
const PREFLIGHT_STEP = 'Refuse to release unless every input is configured';

test('dry run: a staging push with nothing configured fails red naming every input', () => {
  const result = dryRun({ secrets: {}, vars: {}, branch: 'staging' });

  assert.equal(result.failedAt, PREFLIGHT_STEP);
  assert.deepEqual(result.invocations, ['git ls-remote origin']);
  assert.match(result.printed, /not fully configured/);
  for (const { name, kind } of REQUIRED_INPUTS) {
    assert.ok(result.printed.includes(`${name} (${kind})`), name);
  }
});

test('dry run: a partly configured deploy fails closed before touching anything', () => {
  const { DATABASE_URL_UNPOOLED: _dropped, ...secrets } = SECRETS;
  const result = dryRun({ secrets, vars: VARS });

  assert.equal(result.failedAt, PREFLIGHT_STEP);
  assert.deepEqual(result.invocations, ['git ls-remote origin']);
  assert.match(result.printed, /DATABASE_URL_UNPOOLED \(secret\)/);
});

test('dry run: a superseded commit deploys nothing and does not fail', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, tip: 'f'.repeat(40) });

  assert.equal(result.failedAt, null);
  assert.deepEqual(result.ran, [GATE_STEP]);
  assert.deepEqual(result.invocations, ['git ls-remote origin']);
});

test("dry run: a staging push migrates staging first, then deploys, and looks up staging's tip", () => {
  const result = dryRun({
    secrets: SECRETS,
    vars: { ...VARS, NEON_BRANCH: 'staging', WEB_URL: 'https://orla-staging.test' },
    branch: 'staging',
  });

  assert.equal(result.failedAt, null, result.printed);
  assert.match(result.printed, /Deploying a1b2c3d to staging\./);
  assert.deepEqual(result.invocations.slice(0, 5), [
    'git ls-remote origin',
    'pnpm install --frozen-lockfile',
    'pnpm turbo run',
    'pnpm db:migrate',
    'pnpm db:seed',
  ]);
  assert.ok(
    result.invocations.indexOf('pnpm db:migrate') <
      result.invocations.indexOf('npx --yes @railway/cli@5.57.2'),
  );
  assert.equal(result.invocations.at(-1), 'pnpm smoke');
  assertNoSecretPrinted(result.printed);
});

test("dry run: staging run handed production's Neon branch refuses before anything is migrated or deployed", () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, branch: 'staging' });

  assert.equal(result.failedAt, 'Migrate, then seed reference data');
  assert.match(
    result.printed,
    /NEON_BRANCH "production" is not the staging environment's Neon branch \(expected "staging"\); refusing to migrate\./,
  );
  assert.ok(!result.invocations.includes('pnpm db:migrate'), result.invocations.join('\n'));
  assert.ok(!result.invocations.some((line) => line.startsWith('npx')));
});

test('dry run: a run for main is refused at the gate and touches nothing', () => {
  const result = dryRun({ secrets: SECRETS, vars: VARS, branch: 'main' });

  assert.equal(result.failedAt, GATE_STEP);
  assert.deepEqual(result.invocations, []);
  assert.match(result.printed, /CI ran on "main", which is not one of staging, production/);
});

test('web: staging deploys a preview and aliases it to the staging host', async () => {
  const calls = [];
  const url = 'https://orla-abc123-team.vercel.app';
  const io = {
    run: async (_command, args, options) => {
      calls.push(args.slice(2).join(' '));
      if (args[2] === 'deploy') {
        // Progress lines can follow the URL: it is the last line that is one, not the last line.
        options.write(`Inspect: https://vercel.com/x\n${url}\nPreview: ${url} [3s]\n`);
      }
    },
    write: () => {},
  };
  await PHASES.web(
    {
      PATH: '/bin',
      DEPLOY_TARGET: 'staging',
      VERCEL_TOKEN: fake('vercel'),
      VERCEL_ORG_ID: 'org',
      VERCEL_PROJECT_ID: 'prj',
      SENTRY_AUTH_TOKEN: fake('sentry'),
      SENTRY_WEB_PROJECT: 'orla-web',
      SENTRY_RELEASE: SHA,
      // An allow-list: the first entry is the alias host.
      WEB_URL: 'https://orla-staging.vercel.app,https://staging.orla.test',
    },
    io,
  );

  assert.deepEqual(calls, [
    'pull --yes --environment=preview --git-branch=staging',
    'build',
    `deploy --prebuilt --env SENTRY_RELEASE=${SHA}`,
    `alias set ${url} orla-staging.vercel.app`,
  ]);
});

test('web: staging refuses to alias a host that is not its own, before building anything', async () => {
  const { io, calls } = recordingIo();
  for (const WEB_URL of ['https://orla.example', 'orla-staging.vercel.app', '']) {
    await assert.rejects(
      PHASES.web(
        {
          DEPLOY_TARGET: 'staging',
          VERCEL_TOKEN: fake('vercel'),
          VERCEL_ORG_ID: 'org',
          VERCEL_PROJECT_ID: 'prj',
          SENTRY_AUTH_TOKEN: fake('sentry'),
          SENTRY_WEB_PROJECT: 'orla-web',
          SENTRY_RELEASE: SHA,
          WEB_URL,
        },
        io,
      ),
      /WEB_URL/,
    );
  }
  assert.equal(calls.length, 0);
});

test('web: staging refuses to alias a host that is not its own, before building anything', async () => {
  const { io, calls } = recordingIo();
  for (const WEB_URL of ['https://orla.example', 'orla-staging.vercel.app', '']) {
    await assert.rejects(
      PHASES.web(
        {
          DEPLOY_TARGET: 'staging',
          VERCEL_TOKEN: fake('vercel'),
          VERCEL_ORG_ID: 'org',
          VERCEL_PROJECT_ID: 'prj',
          SENTRY_AUTH_TOKEN: fake('sentry'),
          SENTRY_WEB_PROJECT: 'orla-web',
          SENTRY_RELEASE: SHA,
          WEB_URL,
        },
        io,
      ),
      /WEB_URL/,
    );
  }
  assert.equal(calls.length, 0);
});

test('web: production stays a production deployment and is not aliased', async () => {
  const { io, calls } = recordingIo();
  await PHASES.web(
    {
      PATH: '/bin',
      DEPLOY_TARGET: 'production',
      VERCEL_TOKEN: fake('vercel'),
      VERCEL_ORG_ID: 'org',
      VERCEL_PROJECT_ID: 'prj',
      SENTRY_AUTH_TOKEN: fake('sentry'),
      SENTRY_WEB_PROJECT: 'orla-web',
      SENTRY_RELEASE: SHA,
    },
    io,
  );

  assert.deepEqual(
    calls.map(({ args }) => args.slice(2).join(' ')),
    [
      'pull --yes --environment=production',
      'build --prod',
      `deploy --prebuilt --prod --env SENTRY_RELEASE=${SHA}`,
    ],
  );
});
