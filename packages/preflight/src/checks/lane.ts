import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LANE_DATABASE_PREFIX } from '../lane/database.js';
import { LANE_ENV_FILE, parseLaneEnv } from '../lane/env.js';
import { type Check, type CheckResult, fail, pass } from '../types.js';

/*
 * *"The lane's web app resolves the lane's API"* — asked twice, because it is
 * two questions with two different answers, and both were asked on 2026-09-07.
 *
 * 1. **The file shape.** *Was this lane ever wired correctly?* Comparisons
 *    against `.env.lane`: no server, no network, nothing a starved box or a
 *    cold compile can confound.
 * 2. **The built origin.** *Would this lane's web app reach its own API?* The
 *    only one that catches the build-time half: `NEXT_PUBLIC_API_URL` is
 *    inlined into the bundle and the CSP when the app is **built**, so a build
 *    not made through `lane:exec` names `localhost:4000` in `connect-src`
 *    whatever the server env says afterwards.
 *
 * A liveness check is neither. Lane 435's first attempt reported a seeded
 * vendor page rendering as proof the wiring was right — but both checkouts run
 * `seed-demo` with deterministic ids, so that page renders identically on both
 * sides of the question it was asked. Every assertion here is one only the
 * correctly-wired lane can satisfy.
 *
 * #448 asked for the second axis as a `curl -sI` against the running web port,
 * and that is the wrong instrument for the same reason: `pnpm preflight` is the
 * gate a ticket runs *before* its dev servers, so in the flow this check is
 * defined by there is nothing listening, and a probe that cannot distinguish
 * "absent" from "still compiling" has to report that as a pass. It would then
 * pass on both sides of its own question. The build writes the finished header
 * into `routes-manifest.json`, which is what the server would go on to serve —
 * so the answer is on disk before anything starts, and reading it there cannot
 * be confounded by a timeout.
 */

const LANE_DATABASE = new RegExp(`/${LANE_DATABASE_PREFIX}([a-z0-9_]+)(?:\\?|$)`);

/**
 * Both output directories, because `next.config.ts` gives development its own
 * `distDir`: `.next` is what `next start` serves and `.next-dev` is what
 * `next dev` serves, and a lane can be running from either. Whichever exist
 * must agree.
 */
export const WEB_BUILD_MANIFESTS = [
  'apps/web/.next/routes-manifest.json',
  'apps/web/.next-dev/routes-manifest.json',
] as const;

export interface WebBuild {
  /** Path as written above, so a failure names the build it read. */
  readonly label: string;
  readonly manifest: string;
}

/**
 * The lane's ticket, read back out of its own database name so the fix can name
 * the exact command to run — `.env.lane` records the ticket nowhere else.
 */
export function laneTicketFrom(values: Record<string, string>): string {
  return LANE_DATABASE.exec(values.DATABASE_URL ?? '')?.[1] ?? '<ticket>';
}

/** The origins on a policy's `connect-src`, or nothing when it has none. */
export function connectSrc(policy: string): readonly string[] {
  const directive = policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('connect-src '));

  return directive === undefined ? [] : directive.slice('connect-src '.length).split(/\s+/);
}

/**
 * The `connect-src` a build baked into its response headers, or `null` when the
 * manifest carries no policy at all. Report-only counts: development emits the
 * header under that name and builds it from the same value.
 */
export function connectSrcFromManifest(manifest: string): readonly string[] | null {
  const parsed: unknown = JSON.parse(manifest);
  const rules = (parsed as { headers?: { headers?: { key: string; value: string }[] }[] }).headers;

  for (const rule of rules ?? []) {
    for (const header of rule.headers ?? []) {
      if (/^content-security-policy(-report-only)?$/i.test(header.key)) {
        return connectSrc(header.value);
      }
    }
  }

  return null;
}

export function evaluateLaneEnvFile(values: Record<string, string>): CheckResult {
  const name = 'Lane env resolves this lane API, not the shared one';
  /*
   * `lane:up`, not `lane:down && lane:up`. `laneEnvAgreesWith` compares every
   * origin the file carries, so a resume rewrites a stale or trimmed file in
   * place — while the teardown would drop the lane database, taking the E2E
   * fixtures and anything the ticket's browser pass has created with it. The
   * remedy for a missing line in a text file must not be destructive.
   */
  const fix = `pnpm lane:up ${laneTicketFrom(values)}`;
  const { PORT: apiPort, WEB_PORT: webPort } = values;

  if (!apiPort || !webPort) {
    const absent = [apiPort ? '' : 'PORT', webPort ? '' : 'WEB_PORT'].filter(Boolean);

    return fail('core', name, `${LANE_ENV_FILE} carries no ${absent.join(' or ')}`, fix);
  }

  const api = `http://localhost:${apiPort}`;
  const web = `http://localhost:${webPort}`;

  /*
   * `API_URL` is the server-side twin of `NEXT_PUBLIC_API_URL` and the half
   * that fails silently: `apps/web/src/lib/api-client.ts` reads it for every
   * Server Component fetch, so without it the root `.env`'s
   * `http://localhost:4000` wins and the lane's *pages* render against another
   * checkout's database while answering 200 throughout. `WEB_URL` is the API's
   * CORS allowlist, and a stale one refuses the lane's own browser.
   */
  const wrong = (
    [
      ['API_URL', api],
      ['NEXT_PUBLIC_API_URL', api],
      ['WEB_URL', web],
    ] as const
  )
    .filter(([key, expected]) => values[key] !== expected)
    .map(([key, expected]) =>
      values[key] === undefined
        ? `${key} is absent (expected ${expected})`
        : `${key} is ${values[key]} (expected ${expected})`,
    );

  if (wrong.length > 0) {
    return fail('core', name, wrong.join(', '), fix);
  }

  return pass('core', name, `API_URL and NEXT_PUBLIC_API_URL → ${api}, WEB_URL → ${web}`);
}

export function evaluateLaneBuild(
  values: Record<string, string>,
  builds: readonly WebBuild[],
): CheckResult {
  const name = 'Lane web build connects to this lane API';
  const ticket = laneTicketFrom(values);
  const fix = `pnpm lane:exec ${ticket} -- pnpm build --filter=./apps/web`;

  // Nothing to compare against. `evaluateLaneEnvFile` has already failed.
  if (!values.PORT) {
    return pass('core', name, `${LANE_ENV_FILE} carries no PORT, so no build was inspected`);
  }

  /*
   * A lane comes up with no `apps/web` build — `lane:up` builds the workspace
   * packages only, deliberately. That is the normal state at the moment this
   * gate runs, and failing on it would make the check noise every operator
   * learns to skip.
   */
  if (builds.length === 0) {
    return pass('core', name, 'apps/web is not built in this lane, so nothing was inspected');
  }

  const api = `http://localhost:${values.PORT}`;

  for (const { label, manifest } of builds) {
    const origins = connectSrcFromManifest(manifest);

    if (origins === null) {
      return fail('core', name, `${label} bakes no Content-Security-Policy`, fix);
    }

    if (!origins.includes(api)) {
      return fail(
        'core',
        name,
        `${label} bakes connect-src ${origins.join(' ')}, which does not name ${api} — it was built outside the lane`,
        fix,
      );
    }
  }

  return pass('core', name, `${builds.map((build) => build.label).join(', ')} → ${api}`);
}

/** Reads whichever of the two build outputs this worktree actually has. */
export function readWebBuilds(repoRoot: string): WebBuild[] {
  return WEB_BUILD_MANIFESTS.filter((label) => existsSync(path.join(repoRoot, label))).map(
    (label) => ({ label, manifest: readFileSync(path.join(repoRoot, label), 'utf8') }),
  );
}

export const laneCheck: Check = {
  id: 11,
  title: 'Lane wiring',
  run(context) {
    const file = path.join(context.repoRoot, LANE_ENV_FILE);

    // Nothing to assert outside a lane, and nothing about a deployment either.
    if (context.target === 'production' || !existsSync(file)) {
      return Promise.resolve([]);
    }

    const values = parseLaneEnv(readFileSync(file, 'utf8'));

    return Promise.resolve([
      evaluateLaneEnvFile(values),
      evaluateLaneBuild(values, readWebBuilds(context.repoRoot)),
    ]);
  },
};
