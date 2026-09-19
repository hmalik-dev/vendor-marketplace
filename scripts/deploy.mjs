#!/usr/bin/env node
/**
 * VEN-397. The phases `.github/workflows/deploy.yml` runs, one per step:
 *
 *   gate → preflight → migrate → api → web → ready
 *
 * The workflow owns the order and the stop-on-failure — every step runs only if
 * the one before it succeeded, and nothing is `if: always()` — while this file
 * owns what each phase refuses. Keeping the logic here rather than in YAML is
 * what lets `deploy.test.mjs` run the real phases, and dry-run the real workflow
 * file, under plain `node`.
 *
 * **Fail closed.** A phase with a missing input exits non-zero naming the input,
 * never skips: a deploy workflow that goes green while deploying nothing is the
 * silent failure this ticket exists to remove.
 *
 * **Nothing secret is printed.** A phase names variables, never values, and every
 * line a child process writes passes through `redactor` before it reaches the
 * log. GitHub masks registered secrets too; this is the half that does not
 * depend on a value having been registered.
 */
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const RAILWAY_CLI = '@railway/cli@5.57.2';
const VERCEL_CLI = 'vercel@59.17.0';

/**
 * Adapters for the API host, keyed by the repository variable `API_HOST`.
 *
 * **A credential belongs in `credentialVariable`, never in `commands`.** Several
 * CLIs also accept one as `--token <value>`; an argument is quoted back in a
 * failure message, and it reaches the log through the process table besides.
 */
export const API_HOSTS = {
  /*
   * D10 as it stands: the Docker image `apps/api/Dockerfile` builds, on Railway.
   * The service was removed on purpose and whether to re-provision it is open on
   * VEN-377, so nothing selects this until an operator sets `API_HOST`. Choosing
   * a different host is an entry in this table and that one variable — nothing
   * else in the workflow names the platform.
   */
  railway: {
    /** The variable the host's CLI reads its credential from. */
    credentialVariable: 'RAILWAY_TOKEN',
    commands: ({ service, release }) => [
      [
        'npx',
        '--yes',
        RAILWAY_CLI,
        'variables',
        '--service',
        service,
        '--set',
        `SENTRY_RELEASE=${release}`,
        '--skip-deploys',
      ],
      ['npx', '--yes', RAILWAY_CLI, 'up', '--ci', '--service', service],
    ],
  },
};

/**
 * What the deploy needs, by the name an operator sets. `secret` values come
 * from repository secrets and the rest from repository variables; preflight is
 * handed only whether each is set, never a value.
 */
export const REQUIRED_INPUTS = [
  { name: 'DATABASE_URL_UNPOOLED', kind: 'secret' },
  { name: 'API_HOST', kind: 'variable' },
  { name: 'API_SERVICE', kind: 'variable' },
  { name: 'API_HOST_TOKEN', kind: 'secret' },
  { name: 'VERCEL_TOKEN', kind: 'secret' },
  { name: 'VERCEL_ORG_ID', kind: 'variable' },
  { name: 'VERCEL_PROJECT_ID', kind: 'variable' },
  { name: 'SENTRY_AUTH_TOKEN', kind: 'secret' },
  { name: 'SENTRY_WEB_PROJECT', kind: 'variable' },
  { name: 'API_URL', kind: 'variable' },
  { name: 'WEB_URL', kind: 'variable' },
];

/** The environment variable preflight reads to learn whether `name` is set. */
export function presenceFlag(name) {
  return `HAS_${name}`;
}

/** Every adapter's name, spelled once for the two phases that report an unknown one. */
const KNOWN_HOSTS = Object.keys(API_HOSTS).join(', ');

export class PhaseError extends Error {}

function blank(value) {
  return value === undefined || value.trim() === '';
}

function need(env, names) {
  const missing = names.filter((name) => blank(env[name]));

  if (missing.length > 0) {
    throw new PhaseError(`Missing ${missing.join(', ')}; refusing to continue (VEN-377).`);
  }
}

/** `names` copied out of `env`, and nothing else. */
function pick(env, names) {
  return Object.fromEntries(
    names.filter((name) => env[name] !== undefined).map((name) => [name, env[name]]),
  );
}

/** What a child needs to find its tools. Nothing secret is on this list. */
const TOOL_ENV = [
  'PATH',
  'HOME',
  'RUNNER_TEMP',
  'CI',
  'npm_config_cache',
  'PNPM_HOME',
  'COREPACK_HOME',
];

/**
 * Removes from a log line every substring that could be a credential this phase
 * holds: each secret value, and the password inside any URL-shaped one, since a
 * driver error can quote a connection string in part.
 */
export function redactor(secretValues) {
  const needles = new Set();

  for (const value of secretValues) {
    if (blank(value)) {
      continue;
    }

    needles.add(value);

    try {
      const { password } = new URL(value);
      if (password) {
        needles.add(password);
        needles.add(decodeURIComponent(password));
      }
    } catch {
      // Not a URL: the whole value is the needle.
    }
  }

  const ordered = [...needles]
    .filter((needle) => needle.length >= 4)
    .sort((a, b) => b.length - a.length);

  return (line) => ordered.reduce((text, needle) => text.split(needle).join('***'), line);
}

/**
 * Runs a command with exactly `env` — never this process's own environment —
 * and streams its output line by line through `redact`. Resolves on exit 0.
 */
export function run(command, args, { env, redact, write }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });

    for (const stream of [child.stdout, child.stderr]) {
      let pending = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        pending += chunk;
        const lines = pending.split('\n');
        pending = lines.pop();
        for (const line of lines) {
          write(`${redact(line)}\n`);
        }
      });
      stream.on('end', () => {
        if (pending) {
          write(`${redact(pending)}\n`);
        }
      });
    }

    /*
     * The failure messages are redacted too, not just the streams. `main`
     * prints a `PhaseError`'s words verbatim, and these two quote `args` — so a
     * future adapter for a CLI that takes `--access-token <value>` on the
     * command line, which several do, would otherwise put the credential in the
     * Actions log on exactly the path where someone goes looking.
     */
    child.on('error', (error) =>
      reject(new PhaseError(redact(`${command} could not start (${error.code ?? 'error'})`))),
    );
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(
            new PhaseError(redact(`${command} ${args.join(' ').slice(0, 60)} exited with ${code}`)),
          ),
    );
  });
}

/**
 * Whether this run should deploy at all.
 *
 * The job's own `if:` already requires CI to have *succeeded* — `skipped` and
 * `cancelled` are not success — and this repeats it, because a condition that
 * lives only in YAML is untested. Then it checks the commit is still `main`'s
 * tip: two merges whose CI runs finish out of order would otherwise deploy the
 * newer release and then roll it back to the older one. A superseded run exits
 * 0 without deploying, because the run for the tip carries both commits.
 */
export function gateVerdict({ conclusion, event, headSha, tipSha }) {
  if (conclusion !== 'success') {
    return {
      deploy: false,
      fail: true,
      message: `CI concluded "${conclusion}", which is not success; not deploying.`,
    };
  }

  if (event !== 'push') {
    return {
      deploy: false,
      fail: true,
      message: `CI ran for "${event}", not a push to main; not deploying.`,
    };
  }

  if (blank(headSha) || blank(tipSha)) {
    return {
      deploy: false,
      fail: true,
      message: 'Could not tell which commit to deploy; not deploying.',
    };
  }

  if (headSha !== tipSha) {
    return {
      deploy: false,
      fail: false,
      message: `${headSha.slice(0, 7)} is no longer main's tip (${tipSha.slice(0, 7)}); the run for the tip deploys both.`,
    };
  }

  return { deploy: true, fail: false, message: `Deploying ${headSha.slice(0, 7)}.` };
}

/** Which required inputs preflight was told are missing, with where each is set. */
export function missingInputs(env) {
  return REQUIRED_INPUTS.filter(({ name }) => env[presenceFlag(name)] !== 'true').map(
    ({ name, kind }) => `${name} (${kind})`,
  );
}

export const PHASES = {
  async gate(env, io) {
    let listing = '';
    await io.run('git', ['ls-remote', 'origin', 'refs/heads/main'], {
      env: pick(env, TOOL_ENV),
      redact: redactor([]),
      write: (text) => {
        listing += text;
      },
    });

    const verdict = gateVerdict({
      conclusion: env.CI_CONCLUSION,
      event: env.CI_EVENT,
      headSha: env.RELEASE_SHA,
      tipSha: listing.trim().split(/\s+/)[0] ?? '',
    });

    io.write(`${verdict.message}\n`);
    if (!blank(env.GITHUB_OUTPUT)) {
      appendFileSync(env.GITHUB_OUTPUT, `deploy=${verdict.deploy}\n`);
    }
    if (verdict.fail) {
      throw new PhaseError(verdict.message);
    }
    /*
     * A green run that shipped nothing is the shape this workflow exists to
     * remove, so the superseded run says so where Actions surfaces it. It stays
     * green rather than failing: the tip's own run normally carries this commit
     * too, and reddening every close pair of merges would spend the signal. The
     * case it does not cover — the tip's CI then fails, so neither commit ships
     * — announces itself as a red CI run on `main`.
     */
    if (!verdict.deploy) {
      io.error(`::warning::${verdict.message}\n`);
    }
  },

  async preflight(env, io) {
    const missing = missingInputs(env);

    if (missing.length > 0) {
      throw new PhaseError(
        `The deploy is not configured: ${missing.join(', ')}. ` +
          'These are provisioned on VEN-377, and the API host itself is decision D10, still open there.',
      );
    }

    if (!Object.hasOwn(API_HOSTS, env.API_HOST ?? '')) {
      throw new PhaseError(
        `API_HOST "${env.API_HOST}" has no adapter in scripts/deploy.mjs (known: ${KNOWN_HOSTS}).`,
      );
    }

    io.write('Every deploy input is configured.\n');
  },

  /*
   * Migrations run before either service, over the **unpooled** URL only: Neon's
   * pooler is PgBouncer in transaction mode, and the migrator's advisory lock and
   * its DDL need one session. `DATABASE_URL` is refused rather than ignored, so a
   * step handed the pooled URL cannot quietly fall back to it, as
   * `resolveMigrationUrl` would. The reference seed follows and is idempotent, so
   * a first deploy against an empty database comes up usable, not ready-but-empty.
   */
  async migrate(env, io) {
    need(env, ['DATABASE_URL_UNPOOLED']);

    if (!blank(env.DATABASE_URL)) {
      throw new PhaseError(
        'DATABASE_URL is set in the migrate step; migrations take DATABASE_URL_UNPOOLED only.',
      );
    }

    const redact = redactor([env.DATABASE_URL_UNPOOLED]);
    const child = pick(env, [...TOOL_ENV, 'DATABASE_URL_UNPOOLED']);

    await io.run('pnpm', ['db:migrate'], { env: child, redact, write: io.write });
    // The seed script reads `DATABASE_URL`; here it is the unpooled one, in this child only.
    await io.run('pnpm', ['db:seed'], {
      env: { ...child, DATABASE_URL: env.DATABASE_URL_UNPOOLED },
      redact,
      write: io.write,
    });
  },

  async api(env, io) {
    need(env, ['API_HOST', 'API_SERVICE', 'API_HOST_TOKEN', 'SENTRY_RELEASE']);

    if (!Object.hasOwn(API_HOSTS, env.API_HOST)) {
      throw new PhaseError(`API_HOST "${env.API_HOST}" has no adapter (known: ${KNOWN_HOSTS}).`);
    }
    const host = API_HOSTS[env.API_HOST];

    const redact = redactor([env.API_HOST_TOKEN]);
    const child = { ...pick(env, TOOL_ENV), [host.credentialVariable]: env.API_HOST_TOKEN };

    for (const [command, ...args] of host.commands({
      service: env.API_SERVICE,
      release: env.SENTRY_RELEASE,
    })) {
      await io.run(command, args, { env: child, redact, write: io.write });
    }
  },

  /*
   * A prebuilt production deploy: `vercel build` runs here, under the release
   * and the source-map credential, so the bundle names the release this
   * workflow is shipping and its maps are uploaded under that name.
   */
  async web(env, io) {
    const vercel = ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'];
    const upload = ['SENTRY_AUTH_TOKEN', 'SENTRY_WEB_PROJECT', 'SENTRY_RELEASE'];
    need(env, [...vercel, ...upload]);

    const redact = redactor([env.VERCEL_TOKEN, env.SENTRY_AUTH_TOKEN]);
    const child = pick(env, [...TOOL_ENV, ...vercel]);
    const build = pick(env, [...TOOL_ENV, ...vercel, ...upload]);
    const cli = ['--yes', VERCEL_CLI];

    await io.run('npx', [...cli, 'pull', '--yes', '--environment=production'], {
      env: child,
      redact,
      write: io.write,
    });
    await io.run('npx', [...cli, 'build', '--prod'], { env: build, redact, write: io.write });
    await io.run(
      'npx',
      [...cli, 'deploy', '--prebuilt', '--prod', '--env', `SENTRY_RELEASE=${env.SENTRY_RELEASE}`],
      {
        env: child,
        redact,
        write: io.write,
      },
    );
  },

  /*
   * The release gate: `GET /ready` on the API — which round-trips the database,
   * where `/health` passes with it unreachable — must name this commit before
   * the deadline, and the web front door must render its data. The poll is the
   * existing smoke check (`packages/preflight/src/smoke`), whose suite pins the
   * deadline, the commit match and the refusal of a 503.
   */
  async ready(env, io) {
    need(env, ['API_URL', 'WEB_URL', 'SENTRY_RELEASE']);

    await io.run('pnpm', ['smoke'], {
      env: {
        ...pick(env, TOOL_ENV),
        SMOKE_API_URL: env.API_URL,
        SMOKE_WEB_URL: env.WEB_URL,
        SMOKE_COMMIT: env.SENTRY_RELEASE,
        SMOKE_DEADLINE_MS: env.SMOKE_DEADLINE_MS ?? '600000',
      },
      redact: redactor([]),
      write: io.write,
    });
  },
};

/** Runs one phase; returns the exit code. `io` is the seam the suite drives. */
export async function main(argv, env, io) {
  const [phase] = argv;

  if (!Object.hasOwn(PHASES, phase ?? '')) {
    io.error(`Usage: node scripts/deploy.mjs <${Object.keys(PHASES).join('|')}>\n`);
    return 2;
  }

  try {
    await PHASES[phase](env, io);
    return 0;
  } catch (error) {
    // Only a PhaseError's own words are printed: they name variables, never values.
    io.error(
      `::error::${error instanceof PhaseError ? error.message : `${phase} failed unexpectedly`}\n`,
    );
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2), process.env, {
    run,
    write: (text) => process.stdout.write(text),
    error: (text) => process.stderr.write(text),
  });
}
