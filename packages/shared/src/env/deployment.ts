/**
 * Whether this process is a deployment, and what its public origin is.
 *
 * The law in `CLAUDE.md` is that *a development default must never be able to
 * reach production*. Enforcing it needs one thing the registry cannot supply:
 * an answer to "am I deployed?". Every consumer used to answer it privately —
 * the Clerk webhook guard read `RAILWAY_PUBLIC_DOMAIN` and so ran on no
 * platform this repository deploys to, while `siteOrigin` read Vercel's
 * variables and so covered only the web app. One module, so a platform is
 * taught once.
 *
 * Nothing here is a registry row on purpose: these are variables the *platform*
 * injects, not values an operator writes into `.env`.
 */

/** A host that has put this process on the public internet. */
export interface Deployment {
  /** Platform name, for error messages. */
  readonly platform: string;
  /**
   * The origin this process is reachable at, when the platform announces one.
   * `null` where it does not — a check that needs an origin then has nothing
   * to compare against, but every other check still applies.
   */
  readonly origin: string | null;
}

/**
 * The declaration a host that announces nothing recognisable can make.
 *
 * Platform detection is unavoidably a list of names, and a list of names is
 * open-ended: a build on a host nobody has taught this file about sees no
 * marker, takes the laptop's value set, and bakes localhost into the artefact —
 * exactly the defect the gate exists to stop, one unnamed platform away. This
 * is the way out that does not require a release: set it in the build
 * environment and the gate is on, whatever the host is called.
 */
export const EXPLICIT_PLATFORM = 'DEPLOYMENT_PLATFORM';
export const EXPLICIT_ORIGIN = 'DEPLOYMENT_ORIGIN';

/**
 * Hosts that mean "this machine". Every spelling, because the point of the
 * check is that a deployment cannot reach any of them, and a check that knows
 * only the word `localhost` is walked past by `127.0.0.1` — or by `LOCALHOST`,
 * if it compares the raw string instead of a parsed hostname.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/** Whether a parsed hostname is one of those. `URL` lower-cases it for us. */
export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

/**
 * Whether a value is a URL pointing back at the machine running it.
 *
 * A value that is not a URL at all — a bucket name, a log level, a key — is
 * never loopback, so this answers `false` rather than guessing. Parsing rather
 * than substring-matching is the whole of it: `?note=//localhost` is not a
 * loopback endpoint, and `http://LOCALHOST:4000` is.
 */
export function isLoopbackUrl(value: string): boolean {
  try {
    return isLoopbackHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

/**
 * Whether **any entry** of a value points back at this machine.
 *
 * `WEB_URL` doubles as the API's CORS allow-list, so a comma-separated list is
 * a legal value — and a whole-string check sees none of its entries:
 * `http://localhost:3000,https://orla.test` is not a URL at all (`3000,https`
 * is not a port), so it answered "not loopback" and booted, with localhost
 * allow-listed *and* handed to Stripe as the Connect return URL, because
 * `canonicalWebOrigin` takes the first entry. Every consumer splits on the
 * comma; so does this.
 */
export function pointsAtLoopback(value: string): boolean {
  return value.split(',').some((entry) => isLoopbackUrl(entry.trim()));
}

/** `host` as an https origin, with any trailing slash removed. */
function httpsOrigin(host: string | undefined): string | null {
  const trimmed = host?.trim().replace(/\/+$/, '');

  if (!trimmed) {
    return null;
  }

  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * How each host announces itself, declared rather than coded.
 *
 * `markers` are the variables whose presence means "you are on me"; `hosts` are
 * the ones a public origin is read from. Both are plain key lists so that
 * `PLATFORM_ENV_KEYS` is *derived* from them: a variable read by a hand-written
 * closure but missing from a hand-kept list would be stripped by Turborepo's
 * strict env mode, and the build would believe it was on a laptop — on the one
 * platform the whole gate exists for.
 *
 * Only the hosts this repository actually deploys to are named. A fourth
 * platform is `DEPLOYMENT_PLATFORM`'s job, not a speculative row's: an entry
 * for a host that has never run this code is untested either way.
 *
 * Entries are tried in order, which only matters for a build running on one
 * platform while targeting another.
 */
const PLATFORMS: readonly {
  readonly platform: string;
  readonly markers: readonly string[];
  /**
   * Read in order; the first non-empty one wins. Vercel names its stable
   * production domain first on purpose, even on a preview deployment: a
   * preview's canonical URL and its share cards should point at production,
   * not at a build-specific hostname that 404s next week.
   */
  readonly hosts: readonly string[];
}[] = [
  {
    platform: 'Vercel',
    markers: ['VERCEL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'],
    hosts: ['VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'],
  },
  {
    platform: 'Render',
    markers: ['RENDER', 'RENDER_EXTERNAL_URL'],
    hosts: ['RENDER_EXTERNAL_URL'],
  },
  {
    platform: 'Railway',
    markers: ['RAILWAY_PUBLIC_DOMAIN', 'RAILWAY_ENVIRONMENT'],
    hosts: ['RAILWAY_PUBLIC_DOMAIN'],
  },
];

/** The first of `keys` carrying a non-blank value. */
function firstValue(source: NodeJS.ProcessEnv, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = source[key]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

/** The platform hosting this process, or `null` when nothing announces one. */
export function deploymentPlatform(source: NodeJS.ProcessEnv = process.env): Deployment | null {
  const declared = source[EXPLICIT_PLATFORM]?.trim();

  if (declared) {
    return { platform: declared, origin: httpsOrigin(source[EXPLICIT_ORIGIN]) };
  }

  for (const candidate of PLATFORMS) {
    if (firstValue(source, candidate.markers) === undefined) {
      continue;
    }

    const host = firstValue(source, candidate.hosts) ?? source[EXPLICIT_ORIGIN];

    return { platform: candidate.platform, origin: httpsOrigin(host) };
  }

  return null;
}

/**
 * The origin this process is reachable at, or `null` when nothing says.
 *
 * The platform's own answer where there is one, and `DEPLOYMENT_ORIGIN`
 * otherwise — a container that only sets `NODE_ENV=production` is a deployment
 * with no platform to ask, and declaring its origin is the only way a check
 * that compares against it can run at all.
 */
export function deploymentOrigin(source: NodeJS.ProcessEnv = process.env): string | null {
  return deploymentPlatform(source)?.origin ?? httpsOrigin(source[EXPLICIT_ORIGIN]);
}

/**
 * Whether a **build** is producing an artefact for a deployment.
 *
 * `NODE_ENV` is useless here and that is the whole difficulty: `next build`
 * and `tsc` set `NODE_ENV=production` for a build on a laptop as readily as
 * for a release, so a build cannot prove which it is from the runtime mode. A
 * platform marker, or `DEPLOYMENT_PLATFORM`, is the only honest signal a build
 * has.
 */
export function isDeployedBuild(source: NodeJS.ProcessEnv = process.env): boolean {
  return deploymentPlatform(source) !== null;
}

/**
 * Whether a **running process** is serving a deployment.
 *
 * Here `NODE_ENV=production` *is* decisive, and it is what makes this
 * platform-independent: no build or typecheck ever executes a server, so a
 * process that reached boot with `NODE_ENV=production` is a production run —
 * on Vercel, on a platform nobody has taught this file about, or in the API's
 * own container, whose `Dockerfile` sets exactly that.
 */
export function isDeployedRuntime(source: NodeJS.ProcessEnv = process.env): boolean {
  return isDeployedBuild(source) || source.NODE_ENV === 'production';
}

/**
 * Every platform-injected variable this module reads, in declaration order and
 * de-duplicated — most platforms list their host variable as a marker too.
 *
 * These go in Turborepo's **`globalEnv`**, not its pass-through list: they
 * change what a build produces, so they have to be part of what its cache key
 * describes. See `TURBO_GLOBAL_ENV_KEYS`.
 */
export const PLATFORM_ENV_KEYS: readonly string[] = [
  ...new Set([
    EXPLICIT_PLATFORM,
    EXPLICIT_ORIGIN,
    ...PLATFORMS.flatMap((candidate) => [...candidate.markers, ...candidate.hosts]),
  ]),
];
