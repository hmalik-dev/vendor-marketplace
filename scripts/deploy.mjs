#!/usr/bin/env node
/**
 * VEN-397, VEN-494, VEN-633. `release` is the one phase
 * `.github/workflows/deploy.yml` invokes; it runs every other phase in order:
 *
 *   gate → preflight → sender → web-build → migrate → api → web-deploy → ready
 *
 * The web is *built* (pulled and compiled) before anything moves, so the step
 * most likely to fail — `vercel build` — fails before the migration or the API
 * ever runs, and only *deployed* once the API is already live on the new
 * commit. Each phase stays callable on its own, for a manual run and for this
 * file's own suite, but the workflow names no phase itself: promoting an older
 * commit calls that commit's `deploy.mjs release`, which can never disagree
 * with a newer `deploy.yml` about what phases exist.
 *
 * Preflight also proves the tier's Neon Auth is its own (VEN-660): the
 * `NEON_AUTH_BASE_URL` it ships is the one Neon reports for `NEON_BRANCH`, and
 * `WEB_URL` is among that branch's trusted domains. The value it checked is
 * then the value that ships, set on the API and the web deployment alike.
 *
 * Each run targets one environment, `staging` or `production`, named by the
 * branch CI ran on (`DEPLOY_TARGET`); nothing else deploys, and `main` never does.
 *
 * The workflow owns nothing about ordering or stop-on-failure — `release`
 * below does, by awaiting each phase in turn and letting a thrown `PhaseError`
 * stop the rest. Keeping the logic here rather than in YAML is what lets
 * `deploy.test.mjs` run the real phases, and dry-run the real workflow file,
 * under plain `node`.
 *
 * **Fail closed.** A phase with a missing input exits non-zero naming the input,
 * and that includes preflight finding *nothing* configured: a run exists only
 * because someone pushed `staging` or `production`, so a release that deployed
 * nothing must never read green.
 *
 * **Nothing secret is printed.** A phase names variables, never values, and every
 * line a child process writes passes through `redactor` before it reaches the
 * log. GitHub masks registered secrets too; this is the half that does not
 * depend on a value having been registered.
 */
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The environments that deploy, each from the branch of the same name. */
export const ENVIRONMENTS = ['staging', 'production'];

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
   * D10, confirmed: the Docker image `apps/api/Dockerfile` builds, on Railway,
   * which runs the staging and production APIs. It is selected by the variable
   * `API_HOST` on each GitHub environment. Choosing
   * a different host is an entry in this table and that one variable — nothing
   * else in the workflow names the platform.
   */
  railway: {
    /** The variable the host's CLI reads its credential from. */
    credentialVariable: 'RAILWAY_TOKEN',
    commands: ({ service, release, neonAuthBaseUrl }) => [
      [
        'npx',
        '--yes',
        RAILWAY_CLI,
        'variables',
        '--service',
        service,
        '--set',
        `SENTRY_RELEASE=${release}`,
        '--set',
        `NEON_AUTH_BASE_URL=${neonAuthBaseUrl}`,
        '--skip-deploys',
      ],
      ['npx', '--yes', RAILWAY_CLI, 'up', '--ci', '--service', service],
    ],
  },
};

/**
 * What the deploy needs, by the name an operator sets. Every one is set on the
 * GitHub **environment** it belongs to (`staging`, `production`), never at the
 * repository level: an environment's name is the same on both tiers, and GitHub
 * falls back from an environment to the repository, so a repository-level value
 * is silently the other tier's. `secret` values are secrets and the rest are
 * variables; preflight is handed only whether each is set, never a value.
 */
export const REQUIRED_INPUTS = [
  { name: 'DATABASE_URL_UNPOOLED', kind: 'secret' },
  { name: 'NEON_BRANCH', kind: 'variable' },
  { name: 'NEON_HOST', kind: 'variable' },
  { name: 'API_HOST', kind: 'variable' },
  { name: 'API_SERVICE', kind: 'variable' },
  { name: 'API_HOST_TOKEN', kind: 'secret' },
  { name: 'VERCEL_TOKEN', kind: 'secret' },
  { name: 'VERCEL_ORG_ID', kind: 'variable' },
  { name: 'VERCEL_PROJECT_ID', kind: 'variable' },
  { name: 'SENTRY_AUTH_TOKEN', kind: 'secret' },
  { name: 'SENTRY_WEB_PROJECT', kind: 'variable' },
  { name: 'WEB_TIER_KEY', kind: 'secret' },
  { name: 'NEON_AUTH_COOKIE_SECRET', kind: 'secret' },
  { name: 'API_URL', kind: 'variable' },
  { name: 'WEB_URL', kind: 'variable' },
  // VEN-609: the API's sender, repeated here so the release can prove Resend verified it.
  { name: 'EMAIL_FROM', kind: 'variable' },
  { name: 'RESEND_API_KEY', kind: 'secret' },
  // VEN-660: the tier's Neon Auth, and what preflight asks Neon about it with.
  { name: 'NEON_AUTH_BASE_URL', kind: 'variable' },
  { name: 'NEON_PROJECT_ID', kind: 'variable' },
  { name: 'NEON_API_KEY', kind: 'secret' },
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

/** The host of a URL, or `''` when it is not one; never throws, so no value reaches a message. */
function urlHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return '';
  }
}

/**
 * `WEB_URL` may be a comma-separated allow-list (it doubles as CORS); its first
 * entry is the canonical origin, trimmed and without a trailing slash.
 */
function webOrigin(env) {
  return env.WEB_URL.split(',')[0].trim().replace(/\/+$/, '');
}

/** The staging/production host that a build gets aliased to. */
function aliasHost(env) {
  return urlHost(webOrigin(env));
}

/** Throws unless `DEPLOY_TARGET` names an environment; returns whether it is production. */
function webTarget(env) {
  const production = env.DEPLOY_TARGET === 'production';
  if (!production && env.DEPLOY_TARGET !== 'staging') {
    throw new PhaseError(
      `DEPLOY_TARGET "${env.DEPLOY_TARGET}" is not one of ${ENVIRONMENTS.join(', ')}.`,
    );
  }
  return production;
}

/**
 * Throws unless a non-production target's `WEB_URL` names its own host. Both
 * `web-build` and `web-deploy` call this — `web-build` so a release that would
 * refuse to alias never spends a build first, `web-deploy` so it refuses the
 * same way when run on its own for a manual release, rather than aliasing
 * production's host to a stray preview build.
 */
function requireAliasHost(env, production) {
  if (production) {
    return;
  }
  need(env, ['WEB_URL']);
  if (!aliasHost(env).includes(env.DEPLOY_TARGET)) {
    throw new PhaseError(
      `WEB_URL is not a ${env.DEPLOY_TARGET} host; refusing to alias a preview deployment to it.`,
    );
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
 * VEN-633. Wraps one of `release`'s phases in a named
 * [log group](https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions#grouping-log-lines),
 * so a single `release` run's log still shows which phase produced a given
 * line — including a thrown `PhaseError`, which `main` prints after this
 * phase's group has already closed, but Actions still attributes to the last
 * group that was open when the step failed.
 */
async function runPhase(io, name, fn) {
  io.write(`::group::${name}\n`);
  try {
    return await fn();
  } finally {
    io.write('::endgroup::\n');
  }
}

/**
 * Whether this run should deploy at all.
 *
 * The job's own `if:` already requires CI to have *succeeded* — `skipped` and
 * `cancelled` are not success — and this repeats it, because a condition that
 * lives only in YAML is untested. It also refuses any branch that is not an
 * environment, then checks the commit is still that branch's tip: two pushes
 * whose CI runs finish out of order would otherwise deploy the newer release
 * and then roll it back to the older one. A superseded run exits
 * 0 without deploying, because the run for the tip carries both commits.
 */
export function gateVerdict({ conclusion, event, branch, headSha, tipSha }) {
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
      message: `CI ran for "${event}", not a push to ${ENVIRONMENTS.join(' or ')}; not deploying.`,
    };
  }

  if (!ENVIRONMENTS.includes(branch)) {
    return {
      deploy: false,
      fail: true,
      message: `CI ran on "${branch}", which is not one of ${ENVIRONMENTS.join(', ')}; not deploying.`,
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
      message: `${headSha.slice(0, 7)} is no longer ${branch}'s tip (${tipSha.slice(0, 7)}); the run for the tip deploys both.`,
    };
  }

  return { deploy: true, fail: false, message: `Deploying ${headSha.slice(0, 7)} to ${branch}.` };
}

/** Which required inputs preflight was told are missing, with where each is set. */
export function missingInputs(env) {
  return REQUIRED_INPUTS.filter(({ name }) => env[presenceFlag(name)] !== 'true').map(
    ({ name, kind }) => `${name} (${kind})`,
  );
}

/**
 * GETs `url` with a 10s timeout, or returns `null` if the request itself
 * throws (offline, DNS, timeout) — shared by `webNamesRelease` and
 * `webServesCoreFlows` (VEN-632) so neither repeats the try/catch.
 */
async function tryFetch(fetchImpl, url, init = {}) {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(10_000) });
  } catch {
    return null;
  }
}

/**
 * Retries `attempt` until it reports `ok`, or until 5s more would cross
 * `SMOKE_DEADLINE_MS` (600000 default) — shared by `webNamesRelease` and
 * `webServesCoreFlows` (VEN-632), so both post-deploy web checks give a
 * build that is still coming up the same runway before either fails it.
 */
async function pollUntilDeadline(env, io, attempt) {
  const sleep = io.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = io.now ?? Date.now;
  const parsed = Number(env.SMOKE_DEADLINE_MS ?? '600000');
  const deadline = Number.isFinite(parsed) ? parsed : 600_000;
  const startedAt = now();

  for (;;) {
    const result = await attempt();
    if (result.ok || now() - startedAt + 5_000 >= deadline) {
      return result;
    }
    await sleep(5_000);
  }
}

/**
 * The variables the running web reads per request, not only at build time
 * (VEN-632/VEN-631). Kept in sync by hand with `apps/web/src/app/api/ready/route.ts`'s
 * `RUNTIME_VARS` — the route reports presence, this list says which presence
 * flags `webNamesRelease` refuses a release without.
 */
const RUNTIME_VARS = [
  'NEON_AUTH_BASE_URL',
  'NEON_AUTH_COOKIE_SECRET',
  'WEB_TIER_KEY',
  'DEPLOY_ENV',
  'WEB_URL',
];

/**
 * VEN-519. Polls `GET <web>/api/ready` until it names `SENTRY_RELEASE` (the
 * commit the API was just proven to serve) or the deadline passes. A short SHA
 * on either side still has to match, as in the API check. The failure names
 * both commits, never a value that is not one.
 *
 * VEN-631/VEN-632: naming the right commit is not enough — a build can see
 * every runtime variable at build time and still run with none of them, which
 * is exactly what left staging's auth down behind a green release. Once the
 * commit matches, this also refuses to pass if `/api/ready`'s `runtimeEnv`
 * reports any of `RUNTIME_VARS` explicitly `false`; the failure names which,
 * never their values. A web still running the build from before this ticket
 * reports no `runtimeEnv` at all — absent is "unknown", not "false", so an
 * old deployment fails on `webServesCoreFlows` below, by its own name, rather
 * than on a check its own build predates.
 */
async function webNamesRelease(env, io) {
  const fetchImpl = io.fetch ?? fetch;
  const web = webOrigin(env);

  const result = await pollUntilDeadline(env, io, async () => {
    const response = await tryFetch(fetchImpl, `${web}/api/ready`);
    let serving = null;
    let runtimeEnv = null;
    let detail = 'did not answer';

    if (response) {
      try {
        const body = response.ok ? await response.json() : null;
        serving = typeof body?.commit === 'string' && body.commit !== '' ? body.commit : null;
        runtimeEnv = body?.runtimeEnv ?? null;
        detail = response.ok ? '' : `answered HTTP ${response.status}`;
      } catch {
        // A body that cannot be parsed is the same as not answering: retried, not fatal —
        // a cold start can serve a truncated response before it is actually ready.
        detail = 'did not answer';
      }
    }

    const shortest = Math.min(serving?.length ?? 0, env.SENTRY_RELEASE.length);
    const ok = shortest > 0 && serving.slice(0, shortest) === env.SENTRY_RELEASE.slice(0, shortest);
    return { ok, serving, detail, runtimeEnv };
  });

  if (!result.ok) {
    throw new PhaseError(
      result.serving
        ? `Web/API skew: the web serves ${result.serving.slice(0, 7)} but the API serves ${env.SENTRY_RELEASE.slice(0, 7)}.`
        : `The web's /api/ready never named ${env.SENTRY_RELEASE.slice(0, 7)} (${result.detail || 'no commit in the answer'}).`,
    );
  }

  const missing = RUNTIME_VARS.filter((name) => result.runtimeEnv?.[name] === false);
  if (missing.length > 0) {
    throw new PhaseError(
      `The web serves ${env.SENTRY_RELEASE.slice(0, 7)} but is missing ${missing.join(', ')} at runtime (VEN-631); refusing to continue.`,
    );
  }

  io.write(`web /api/ready names ${env.SENTRY_RELEASE.slice(0, 7)}\n`);
}

/** The sign-in form's stable marker (`sign-in-form.tsx`); a status code alone is not proof it rendered. */
const SIGN_IN_MARKER = 'name="email"';

/**
 * VEN-632. `/api/ready` proves the build; this proves the runtime actually
 * serves the flows a visitor needs. Same retry loop and deadline as
 * `webNamesRelease`, a 10s timeout per request, through `io.fetch` so the
 * suite can drive it — called after `webNamesRelease`, once the origin is
 * proven to be on this build.
 *
 * Three checks, in order:
 * 1. `GET /api/auth/get-session` with no cookie: any 5xx (or other non-2xx)
 *    fails naming the status; a non-JSON body or one carrying an `error` key
 *    fails too. The body itself is never echoed.
 * 2. `GET /sign-in`: 200 and the HTML contains `SIGN_IN_MARKER` — a status
 *    code alone passed during the outage this check exists for.
 * 3. `GET /`: 200.
 */
async function webServesCoreFlows(env, io) {
  const fetchImpl = io.fetch ?? fetch;
  const web = webOrigin(env);

  const result = await pollUntilDeadline(env, io, async () => {
    const session = await tryFetch(fetchImpl, `${web}/api/auth/get-session`);
    if (!session) {
      return { ok: false, message: 'web auth did not answer' };
    }
    if (!session.ok) {
      return { ok: false, message: `web auth answered HTTP ${session.status}` };
    }
    const contentType = session.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        message: `web auth answered a non-JSON content-type (${contentType || 'none'})`,
      };
    }
    let body;
    try {
      body = await session.json();
    } catch {
      return { ok: false, message: 'web auth answered a session body that could not be parsed' };
    }
    if (body !== null && (typeof body !== 'object' || Array.isArray(body) || 'error' in body)) {
      return { ok: false, message: 'web auth answered an unexpected session body' };
    }

    const signIn = await tryFetch(fetchImpl, `${web}/sign-in`);
    if (!signIn) {
      return { ok: false, message: 'web sign-in did not answer' };
    }
    if (!signIn.ok) {
      return { ok: false, message: `web sign-in answered HTTP ${signIn.status}` };
    }
    let html;
    try {
      html = await signIn.text();
    } catch {
      return { ok: false, message: 'web sign-in answered a body that could not be read' };
    }
    if (!html.includes(SIGN_IN_MARKER)) {
      return { ok: false, message: 'web sign-in did not render the sign-in form' };
    }

    const home = await tryFetch(fetchImpl, web);
    if (!home) {
      return { ok: false, message: 'web home did not answer' };
    }
    if (!home.ok) {
      return { ok: false, message: `web home answered HTTP ${home.status}` };
    }

    return { ok: true };
  });

  if (!result.ok) {
    throw new PhaseError(result.message);
  }
}

const NEON_API = 'https://console.neon.tech/api/v2';

/** A URL's origin, the form Neon Auth's trusted domains take; `''` when it is not one. */
function urlOrigin(value) {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return '';
  }
}

/** A base URL compared the way a client joins paths onto it: trimmed, no trailing slash. */
function baseUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

/**
 * GETs one Neon API path under `NEON_API_KEY`. A failure names what was being
 * read and the status, never the key or a body.
 */
async function neonGet(env, io, path, what) {
  const response = await tryFetch(io.fetch ?? fetch, `${NEON_API}${path}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${env.NEON_API_KEY}` },
  });
  if (!response?.ok) {
    throw new PhaseError(
      `The Neon API ${response ? `answered HTTP ${response.status}` : 'did not answer'} for ${what}; refusing to release.`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new PhaseError(`The Neon API answered ${what} with a body that could not be parsed.`);
  }
}

/**
 * VEN-660. A release refuses to ship a tier pointed at another tier's Neon
 * Auth. It asks Neon — as `neon neon-auth status --branch <NEON_BRANCH>` and
 * `neon neon-auth domain list` do — for the Neon Auth of the branch named
 * `NEON_BRANCH`, then fails by name when `NEON_AUTH_BASE_URL` is not that
 * integration's base URL, or when `WEB_URL`'s origin is not among its trusted
 * domains. The first is a sign-up landing in the wrong tier's identities; the
 * second is Neon Auth refusing, or redirecting away from, this tier's own
 * host. Hosts are named in a failure, since both are public; the key never is.
 */
export async function checkNeonAuth(env, io) {
  need(env, [
    'NEON_API_KEY',
    'NEON_PROJECT_ID',
    'NEON_BRANCH',
    'NEON_AUTH_BASE_URL',
    'WEB_URL',
    'DEPLOY_TARGET',
  ]);
  const project = encodeURIComponent(env.NEON_PROJECT_ID.trim());
  const name = env.NEON_BRANCH.trim();

  // A whole variable set fallen back from the other tier agrees with itself; only the target can tell.
  if (name !== env.DEPLOY_TARGET) {
    throw new PhaseError(
      `NEON_BRANCH "${name}" is not the ${env.DEPLOY_TARGET} environment's Neon branch; refusing to release.`,
    );
  }

  const { branches } = await neonGet(env, io, `/projects/${project}/branches`, 'the branches');
  const branch = Array.isArray(branches) ? branches.find((b) => b?.name === name) : undefined;
  if (!branch) {
    throw new PhaseError(
      `NEON_BRANCH "${name}" is not a branch of NEON_PROJECT_ID; refusing to release.`,
    );
  }

  const auth = `/projects/${project}/branches/${encodeURIComponent(branch.id)}/auth`;
  const { base_url: expected } = await neonGet(env, io, auth, `the ${name} branch's Neon Auth`);
  if (typeof expected !== 'string' || expected === '') {
    throw new PhaseError(`The ${name} Neon branch has no Neon Auth base URL; refusing to release.`);
  }
  if (baseUrl(env.NEON_AUTH_BASE_URL) !== baseUrl(expected)) {
    throw new PhaseError(
      `NEON_AUTH_BASE_URL (${urlHost(env.NEON_AUTH_BASE_URL) || 'not a URL'}) is not the Neon Auth base URL of the ${name} Neon branch (${urlHost(expected)}); refusing to release.`,
    );
  }

  const { domains } = await neonGet(
    env,
    io,
    `${auth}/domains`,
    `the ${name} branch's Neon Auth trusted domains`,
  );
  const web = urlOrigin(webOrigin(env));
  const trusted = Array.isArray(domains) ? domains.map((d) => urlOrigin(d?.domain ?? '')) : [];
  if (web === '' || !trusted.includes(web)) {
    throw new PhaseError(
      `WEB_URL (${web || 'not a URL'}) is not a trusted domain of the ${name} Neon branch's Neon Auth; refusing to release.`,
    );
  }

  io.write(`Neon Auth: NEON_AUTH_BASE_URL and WEB_URL are the ${name} branch's own.\n`);
}

export const PHASES = {
  async gate(env, io) {
    const branch = env.DEPLOY_TARGET;
    let listing = '';
    // Only an environment's own ref is looked up; any other branch is refused by the verdict.
    if (ENVIRONMENTS.includes(branch)) {
      await io.run('git', ['ls-remote', 'origin', `refs/heads/${branch}`], {
        env: pick(env, TOOL_ENV),
        redact: redactor([]),
        write: (text) => {
          listing += text;
        },
      });
    }

    const verdict = gateVerdict({
      conclusion: env.CI_CONCLUSION,
      event: env.CI_EVENT,
      branch,
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
    return verdict;
  },

  async preflight(env, io) {
    const missing = missingInputs(env);

    if (missing.length > 0) {
      throw new PhaseError(
        `The deploy is not fully configured; missing: ${missing.join(', ')}. ` +
          'Set them on the GitHub environment named for the pushed branch (docs/environments.md); Railway is the API host.',
      );
    }

    if (!Object.hasOwn(API_HOSTS, env.API_HOST ?? '')) {
      throw new PhaseError(
        `API_HOST "${env.API_HOST}" has no adapter in scripts/deploy.mjs (known: ${KNOWN_HOSTS}).`,
      );
    }

    await checkNeonAuth(env, io);

    if (!blank(env.GITHUB_OUTPUT)) appendFileSync(env.GITHUB_OUTPUT, 'ready=true\n');
    io.write('Every deploy input is configured.\n');
  },

  /*
   * VEN-609. The sending domain must be verified in Resend before anything
   * moves: an unverified one is refused on every send and the API only logs
   * it, so booking email, the admin step-up code and the operator pager would
   * all go quiet behind a green release. The check is launch:check's own
   * probe (`packages/preflight/src/launch/sender.ts`), where a key that cannot
   * list domains fails rather than asking a person to look.
   */
  async sender(env, io) {
    need(env, ['EMAIL_FROM', 'RESEND_API_KEY']);

    await io.run('pnpm', ['release:sender'], {
      env: pick(env, [...TOOL_ENV, 'EMAIL_FROM', 'RESEND_API_KEY']),
      redact: redactor([env.RESEND_API_KEY]),
      write: io.write,
    });
  },

  /*
   * Migrations run before either service, over the **unpooled** URL only: Neon's
   * pooler is PgBouncer in transaction mode, and the migrator's advisory lock and
   * its DDL need one session. `DATABASE_URL` is refused rather than ignored, so a
   * step handed the pooled URL cannot quietly fall back to it, as
   * `resolveMigrationUrl` would. The reference seed follows and is idempotent, so
   * a first deploy against an empty database comes up usable, not ready-but-empty.
   *
   * The Neon branch behind the URL is declared per environment as `NEON_BRANCH`
   * and must be the environment's own name, and the URL's host must be the
   * `NEON_HOST` declared beside it. The first catches a whole variable set
   * falling back to the other tier; the second catches the secret alone doing
   * so, which `NEON_BRANCH` cannot see. Together, staging's run cannot migrate
   * production's database, nor the reverse.
   */
  async migrate(env, io) {
    need(env, ['DATABASE_URL_UNPOOLED', 'DEPLOY_TARGET', 'NEON_BRANCH', 'NEON_HOST']);

    if (!ENVIRONMENTS.includes(env.DEPLOY_TARGET)) {
      throw new PhaseError(
        `DEPLOY_TARGET "${env.DEPLOY_TARGET}" is not one of ${ENVIRONMENTS.join(', ')}; refusing to migrate.`,
      );
    }

    if (env.NEON_BRANCH.trim() !== env.DEPLOY_TARGET) {
      throw new PhaseError(
        `NEON_BRANCH "${env.NEON_BRANCH}" is not the ${env.DEPLOY_TARGET} environment's Neon branch (expected "${env.DEPLOY_TARGET}"); refusing to migrate.`,
      );
    }

    if (urlHost(env.DATABASE_URL_UNPOOLED) !== env.NEON_HOST.trim()) {
      throw new PhaseError(
        `DATABASE_URL_UNPOOLED is not on NEON_HOST, the ${env.DEPLOY_TARGET} environment's Neon endpoint; refusing to migrate.`,
      );
    }

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
    need(env, [
      'API_HOST',
      'API_SERVICE',
      'API_HOST_TOKEN',
      'SENTRY_RELEASE',
      'NEON_AUTH_BASE_URL',
    ]);

    if (!Object.hasOwn(API_HOSTS, env.API_HOST)) {
      throw new PhaseError(`API_HOST "${env.API_HOST}" has no adapter (known: ${KNOWN_HOSTS}).`);
    }
    const host = API_HOSTS[env.API_HOST];

    const redact = redactor([env.API_HOST_TOKEN]);
    const child = { ...pick(env, TOOL_ENV), [host.credentialVariable]: env.API_HOST_TOKEN };

    for (const [command, ...args] of host.commands({
      service: env.API_SERVICE,
      release: env.SENTRY_RELEASE,
      neonAuthBaseUrl: baseUrl(env.NEON_AUTH_BASE_URL),
    })) {
      await io.run(command, args, { env: child, redact, write: io.write });
    }
  },

  /*
   * `vercel build` runs here, under the release and the source-map credential,
   * so the bundle names the release this workflow is shipping and its maps are
   * uploaded under that name. It runs before either service moves (VEN-633):
   * the step most likely to fail fails before anything has shipped.
   *
   * Production builds a production deployment. Staging builds a preview
   * deployment from the Preview environment's variables (Hobby has no custom
   * environments). `requireAliasHost` runs here too, before the build, not only
   * in `web-deploy`: WEB_URL resolves environment → repository, so a
   * repository-level value would be production's, and a release that would
   * refuse to alias should never spend a build first.
   *
   * VEN-575: `WEB_TIER_KEY` and `NEON_AUTH_COOKIE_SECRET` are Secret-type Vercel
   * variables, which `vercel pull` writes as empty strings, so the build would
   * validate blanks. They come from the GitHub environment's secrets instead and
   * reach the `vercel build` process's environment only: never argv, never a
   * file, never `pull` or `deploy`.
   */
  async 'web-build'(env, io) {
    const vercel = ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'];
    const upload = ['SENTRY_AUTH_TOKEN', 'SENTRY_WEB_PROJECT', 'SENTRY_RELEASE'];
    const buildSecrets = ['WEB_TIER_KEY', 'NEON_AUTH_COOKIE_SECRET'];
    need(env, [
      ...vercel,
      ...upload,
      ...buildSecrets,
      'API_URL',
      'DEPLOY_TARGET',
      'NEON_AUTH_BASE_URL',
    ]);

    const production = webTarget(env);
    requireAliasHost(env, production);

    const redact = redactor([
      env.VERCEL_TOKEN,
      env.SENTRY_AUTH_TOKEN,
      ...buildSecrets.map((name) => env[name]),
    ]);
    const child = pick(env, [...TOOL_ENV, ...vercel]);
    // servesOverTls (apps/web/src/config/env.ts) needs the platform's own announcement;
    // WEB_URL's first entry is that origin, already https:// for both environments.
    // API_URL/NEXT_PUBLIC_API_URL (VEN-599): the GitHub environment's own value,
    // never Vercel's per-environment dashboard configuration via `vercel pull`.
    const build = {
      ...pick(env, [...TOOL_ENV, ...vercel, ...upload, ...buildSecrets]),
      DEPLOYMENT_ORIGIN: webOrigin(env),
      API_URL: env.API_URL,
      NEXT_PUBLIC_API_URL: env.API_URL,
      // VEN-660: the Neon Auth preflight proved is this tier's, not whatever `vercel pull` holds.
      NEON_AUTH_BASE_URL: baseUrl(env.NEON_AUTH_BASE_URL),
    };
    const cli = ['--yes', VERCEL_CLI];
    const target = production ? ['--prod'] : [];

    /*
     * Staging's variables are scoped to the Preview `staging` branch, and a pull
     * without the branch returns only the all-branch Preview ones. `vercel build`
     * then reads the `.vercel/.env.preview.local` this writes, with no flag.
     */
    const scope = production
      ? ['--environment=production']
      : ['--environment=preview', `--git-branch=${env.DEPLOY_TARGET}`];

    /*
     * VEN-631: the checkout that put this commit here (`actions/checkout` with
     * a `ref:` SHA) leaves the repository in detached HEAD, so `vercel deploy`
     * reads no branch off it and tags the deployment `gitSource: null`. With
     * no branch attached, Vercel cannot tell this deployment belongs to the
     * `Preview (staging)` environment, so it serves the deployment with *no*
     * environment variables at runtime, Config-type included — not only the
     * two Secret-type ones VEN-575 handed to `vercel build` directly. A local
     * branch named for the environment gives `vercel deploy` a git ref to
     * read, the same unambiguous signal `--prod` is for production. Production
     * is unaffected: it is never checked out onto a branch, exactly as before.
     */
    if (!production) {
      await io.run('git', ['checkout', '-B', env.DEPLOY_TARGET], {
        env: child,
        redact,
        write: io.write,
      });
    }
    await io.run('npx', [...cli, 'pull', '--yes', ...scope], {
      env: child,
      redact,
      write: io.write,
    });
    await io.run('npx', [...cli, 'build', ...target], { env: build, redact, write: io.write });
  },

  /*
   * The other half of `web-build` (VEN-633): ships the build it already
   * produced, only once the API is live on this commit. `vercel deploy
   * --prebuilt` reuses that build rather than compiling again, so nothing here
   * can fail the way `vercel build` does.
   *
   * Production is a production deployment, so it needs no alias. Staging
   * aliases its preview deployment to the host of `WEB_URL` so the readiness
   * poll and people have one stable address; `vercel deploy` prints the
   * deployment's URL on its own line, which is what the alias names.
   */
  async 'web-deploy'(env, io) {
    const vercel = ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'];
    need(env, [...vercel, 'DEPLOY_TARGET', 'SENTRY_RELEASE', 'NEON_AUTH_BASE_URL']);

    const production = webTarget(env);
    // Re-checked here, not only in `web-build`: a manual `web-deploy` run
    // must refuse to alias a stray preview to production's host exactly as
    // it did before the split, rather than trusting that `web-build` already
    // ran first in the same process.
    requireAliasHost(env, production);

    const redact = redactor([env.VERCEL_TOKEN]);
    const child = pick(env, [...TOOL_ENV, ...vercel]);
    const cli = ['--yes', VERCEL_CLI];
    const target = production ? ['--prod'] : [];

    let printed = '';
    await io.run(
      'npx',
      [
        ...cli,
        'deploy',
        '--prebuilt',
        ...target,
        '--env',
        `SENTRY_RELEASE=${env.SENTRY_RELEASE}`,
        // VEN-660: the runtime reads the value preflight checked, not the dashboard's.
        '--env',
        `NEON_AUTH_BASE_URL=${baseUrl(env.NEON_AUTH_BASE_URL)}`,
      ],
      {
        env: child,
        redact,
        write: (text) => {
          printed += text;
          io.write(text);
        },
      },
    );

    if (!production) {
      // stdout and stderr share one stream here, so the URL is the last line that is one.
      const deployment = printed
        .split('\n')
        .map((line) => line.trim())
        .findLast((line) => /^https:\/\/[\w.-]+$/.test(line));
      if (!deployment) {
        throw new PhaseError('vercel deploy did not print a deployment URL to alias.');
      }
      await io.run('npx', [...cli, 'alias', 'set', deployment, aliasHost(env)], {
        env: child,
        redact,
        write: io.write,
      });
    }
  },

  /*
   * The release gate: `GET /ready` on the API — which round-trips the database,
   * where `/health` passes with it unreachable — must name this commit before
   * the deadline, and the web front door must render its data. The poll is the
   * existing smoke check (`packages/preflight/src/smoke`), whose suite pins the
   * deadline, the commit match and the refusal of a 503. Then the web build
   * must name the same commit at `/api/ready` (VEN-519): the API moving while
   * the web stays on an old build is skew the API's answer cannot show.
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

    await webNamesRelease(env, io);
    await webServesCoreFlows(env, io);
  },

  /*
   * VEN-633. The one phase `.github/workflows/deploy.yml` calls: every other
   * phase, in the order this file's header names. `gate` is the only phase
   * that can stop the rest without failing — a superseded commit returns
   * `{ deploy: false }` and this phase simply returns, exactly as the old
   * per-step `if: steps.gate.outputs.deploy == 'true'` skipped every step
   * after it. Every other phase either finishes or throws a `PhaseError`,
   * which `main` below turns into the same non-zero exit a standalone phase
   * would have produced.
   */
  async release(env, io) {
    const verdict = await runPhase(io, 'gate', () => PHASES.gate(env, io));
    if (!verdict.deploy) {
      return;
    }

    await runPhase(io, 'preflight', () => PHASES.preflight(env, io));
    await runPhase(io, 'sender', () => PHASES.sender(env, io));
    await runPhase(io, 'web-build', () => PHASES['web-build'](env, io));
    await runPhase(io, 'migrate', () => PHASES.migrate(env, io));
    await runPhase(io, 'api', () => PHASES.api(env, io));
    await runPhase(io, 'web-deploy', () => PHASES['web-deploy'](env, io));
    await runPhase(io, 'ready', () => PHASES.ready(env, io));
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
