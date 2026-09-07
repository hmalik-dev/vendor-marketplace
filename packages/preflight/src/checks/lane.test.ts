import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  connectSrc,
  connectSrcFromManifest,
  evaluateLaneBuild,
  evaluateLaneEnvFile,
  laneCheck,
  laneTicketFrom,
  readWebBuilds,
  WEB_BUILD_MANIFESTS,
} from './lane.js';

const laneEnv = {
  PORT: '4007',
  WEB_PORT: '3007',
  API_URL: 'http://localhost:4007',
  NEXT_PUBLIC_API_URL: 'http://localhost:4007',
  WEB_URL: 'http://localhost:3007',
  DATABASE_URL: 'postgresql://localhost:5432/vendor_marketplace_lane_448',
};

const policy = (apiOrigin: string): string =>
  [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'`,
    `connect-src 'self' ${apiOrigin} https://clerk.example.com`,
    `frame-src 'self'`,
  ].join('; ');

/** The shape `next build` writes, trimmed to the parts this check reads. */
const manifest = (apiOrigin: string, key = 'Content-Security-Policy'): string =>
  JSON.stringify({
    version: 3,
    headers: [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key, value: policy(apiOrigin) },
        ],
      },
    ],
  });

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'lane-check-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeBuild(label: string, contents: string): void {
  const file = path.join(root, label);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

function writeLaneEnv(values: Record<string, string>): void {
  writeFileSync(
    path.join(root, '.env.lane'),
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );
}

describe('laneTicketFrom', () => {
  it('reads the ticket back out of the lane database name', () => {
    expect(laneTicketFrom(laneEnv)).toBe('448');
  });

  it('falls back to a placeholder rather than naming the wrong lane', () => {
    expect(laneTicketFrom({ DATABASE_URL: 'postgresql://localhost:5432/vendor_marketplace' })).toBe(
      '<ticket>',
    );
    expect(laneTicketFrom({})).toBe('<ticket>');
  });
});

/**
 * Axis one — *was this lane ever wired correctly?* Comparisons against the
 * file, no server and no network, so nothing about a starved box, a cold
 * compile or an expired session can confound it. It is the axis that settled
 * lane 441: `.env.lane` either carries `API_URL` or it does not.
 */
describe('evaluateLaneEnvFile', () => {
  it('passes a lane whose file points every origin at the lane itself', () => {
    const result = evaluateLaneEnvFile(laneEnv);
    expect(result.ok).toBe(true);
    expect(result.detail).toContain('http://localhost:4007');
    expect(result.detail).toContain('http://localhost:3007');
  });

  /*
   * The original defect. `API_URL` is what `apps/web/src/lib/api-client.ts`
   * reads for every Server Component fetch; without it the root `.env`'s
   * `http://localhost:4000` wins and the lane's pages render against another
   * checkout's database, answering 200 the whole time.
   */
  it('fails a lane whose file has no API_URL at all', () => {
    const { API_URL: _omitted, ...stale } = laneEnv;
    const result = evaluateLaneEnvFile(stale);

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('API_URL is absent');
  });

  it('fails a lane whose file names another lane API port', () => {
    const result = evaluateLaneEnvFile({ ...laneEnv, API_URL: 'http://localhost:4000' });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('API_URL is http://localhost:4000');
    expect(result.detail).toContain('expected http://localhost:4007');
  });

  it('fails a lane whose API would refuse its own web origin', () => {
    // `allowedOrigins()` splits WEB_URL, so a stale one is CORS failure on
    // every client-side call — which reads as the change under test breaking.
    const result = evaluateLaneEnvFile({ ...laneEnv, WEB_URL: 'http://localhost:3000' });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('WEB_URL is http://localhost:3000');
  });

  it('fails a file carrying no ports rather than comparing against undefined', () => {
    const result = evaluateLaneEnvFile({ API_URL: 'http://localhost:4007' });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('PORT');
    expect(result.detail).toContain('WEB_PORT');
  });

  /*
   * The remedy must not be destructive. `lane:down` drops the lane database,
   * which takes the E2E fixtures and everything the ticket's browser pass has
   * created — an absurd price for a missing line in a text file, and one a
   * resume no longer needs now that `laneEnvAgreesWith` rewrites the file.
   */
  it('offers a repair that keeps the lane database', () => {
    const { API_URL: _omitted, ...stale } = laneEnv;

    expect(evaluateLaneEnvFile(stale).fix).toBe('pnpm lane:up 448');
  });
});

describe('connectSrc', () => {
  it('reads the origins off the connect-src directive alone', () => {
    expect(connectSrc(policy('http://localhost:4007'))).toEqual([
      "'self'",
      'http://localhost:4007',
      'https://clerk.example.com',
    ]);
  });

  it('returns nothing when the policy has no connect-src', () => {
    expect(connectSrc("default-src 'self'")).toEqual([]);
  });
});

describe('connectSrcFromManifest', () => {
  it('finds the policy the build baked into its response headers', () => {
    expect(connectSrcFromManifest(manifest('http://localhost:4007'))).toContain(
      'http://localhost:4007',
    );
  });

  it('reads the report-only header development emits', () => {
    const reportOnly = manifest('http://localhost:4007', 'Content-Security-Policy-Report-Only');

    expect(connectSrcFromManifest(reportOnly)).toContain('http://localhost:4007');
  });

  it('distinguishes a manifest with no policy from one with an empty connect-src', () => {
    expect(connectSrcFromManifest(JSON.stringify({ version: 3, headers: [] }))).toBeNull();
    expect(connectSrcFromManifest(JSON.stringify({ version: 3 }))).toBeNull();
  });
});

/**
 * Axis two — *would this lane's web app reach its own API?* Independent of the
 * file, because `NEXT_PUBLIC_API_URL` is inlined into the bundle and the CSP at
 * **build** time: a build not made through `lane:exec` bakes `localhost:4000`
 * into `connect-src` whatever the server env then says. Lane 441 measured
 * exactly that — SSR resolving 4021 correctly while `connect-src` named 4000,
 * on the same server, in the same second.
 *
 * Read off the build rather than off a running server on purpose. `pnpm
 * preflight` runs *before* the dev servers, so a request-based probe finds
 * nothing listening in the very flow this check is defined by — and cannot tell
 * that from a server still cold-compiling, so it has to call both a pass. That
 * is a check that passes on both sides of its own question, which is the thing
 * #448 exists to stop.
 */
describe('evaluateLaneBuild', () => {
  const built = (apiOrigin: string) => [
    { label: WEB_BUILD_MANIFESTS[0], manifest: manifest(apiOrigin) },
  ];

  it('passes a build that names the lane API', () => {
    const result = evaluateLaneBuild(laneEnv, built('http://localhost:4007'));

    expect(result.ok).toBe(true);
    expect(result.detail).toContain('http://localhost:4007');
  });

  it('fails a build made outside the lane, which names the shared API', () => {
    const result = evaluateLaneBuild(laneEnv, built('http://localhost:4000'));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('http://localhost:4000');
    expect(result.detail).toContain('built outside the lane');
    expect(result.fix).toBe('pnpm lane:exec 448 -- pnpm build --filter=./apps/web');
  });

  /*
   * `next.config.ts` gives development its own `distDir`, so a lane can be
   * serving from either directory. Checking only `.next` would pass a lane
   * whose `next dev` output is the stale one.
   */
  it('fails when either build directory disagrees, not only the production one', () => {
    const result = evaluateLaneBuild(laneEnv, [
      { label: WEB_BUILD_MANIFESTS[0], manifest: manifest('http://localhost:4007') },
      { label: WEB_BUILD_MANIFESTS[1], manifest: manifest('http://localhost:4000') },
    ]);

    expect(result.ok).toBe(false);
    expect(result.detail).toContain(WEB_BUILD_MANIFESTS[1]);
  });

  it('fails a build that bakes no policy at all', () => {
    const result = evaluateLaneBuild(laneEnv, [
      { label: WEB_BUILD_MANIFESTS[0], manifest: JSON.stringify({ version: 3, headers: [] }) },
    ]);

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('no Content-Security-Policy');
  });

  /*
   * Not a failure: `lane:up` builds the workspace packages and deliberately not
   * the apps, so an unbuilt `apps/web` is what every lane looks like at the
   * moment this gate runs.
   */
  it('reports rather than fails when the lane has no web build yet', () => {
    const result = evaluateLaneBuild(laneEnv, []);

    expect(result.ok).toBe(true);
    expect(result.detail).toContain('not built');
  });

  it('says it inspected nothing rather than comparing against an undefined port', () => {
    const result = evaluateLaneBuild({}, built('http://localhost:4007'));

    expect(result.ok).toBe(true);
    expect(result.detail).toContain('no PORT');
    expect(result.detail).not.toContain('undefined');
  });
});

describe('readWebBuilds', () => {
  it('reads only the build directories that exist', () => {
    writeBuild(WEB_BUILD_MANIFESTS[1], manifest('http://localhost:4007'));

    expect(readWebBuilds(root).map((build) => build.label)).toEqual([WEB_BUILD_MANIFESTS[1]]);
  });

  it('finds nothing in a lane that has not built the web app', () => {
    expect(readWebBuilds(root)).toEqual([]);
  });
});

describe('laneCheck', () => {
  const context = (target: 'local' | 'production') => ({
    repoRoot: root,
    env: {},
    envFileFound: true,
    capabilities: new Set<never>(),
    target,
  });

  it('asserts both axes inside a lane', async () => {
    writeLaneEnv(laneEnv);
    writeBuild(WEB_BUILD_MANIFESTS[0], manifest('http://localhost:4007'));

    const results = await laneCheck.run(context('local'));

    expect(results.map((result) => result.ok)).toEqual([true, true]);
    expect(results[1]?.detail).toContain('http://localhost:4007');
  });

  it('fails the lane whose build was made outside it', async () => {
    writeLaneEnv(laneEnv);
    writeBuild(WEB_BUILD_MANIFESTS[0], manifest('http://localhost:4000'));

    const results = await laneCheck.run(context('local'));

    expect(results[0]?.ok).toBe(true);
    expect(results[1]?.ok).toBe(false);
  });

  it('asserts nothing outside a lane, where there is no .env.lane', async () => {
    await expect(laneCheck.run(context('local'))).resolves.toEqual([]);
  });

  // A lane is a local construct; `--production` gates a deployment.
  it('asserts nothing against a deployment', async () => {
    writeLaneEnv(laneEnv);

    await expect(laneCheck.run(context('production'))).resolves.toEqual([]);
  });
});
