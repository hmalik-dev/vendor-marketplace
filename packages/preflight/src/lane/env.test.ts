import { describe, expect, it } from 'vitest';
import {
  childEnv,
  laneChildEnv,
  LANE_WEB_TIER_KEY_SHAPE,
  parseLaneEnv,
  renderLaneEnv,
} from './env.js';
import { LANE_STORAGE_KEYS } from './storage.js';
import { laneStorageFixture } from './storage.fixture.js';
import type { LaneManifest } from './manifest.js';

const manifest: LaneManifest = {
  ticket: '42',
  branch: 'lane/42',
  worktreePath: '/repo/.claude/worktrees/42',
  apiPort: 4007,
  webPort: 3007,
  database: 'vendor_marketplace_lane_42',
  prUrl: null,
  state: 'active',
  createdAt: '2026-08-28T00:00:00.000Z',
};

const databaseUrl = 'postgresql://localhost:5432/vendor_marketplace_lane_42';
const WEB_TIER_KEY = 'a'.repeat(64);

describe('renderLaneEnv', () => {
  /* VEN-662: a lane's sign-up records its role at the API, which needs the key. */
  it('gives the lane its own web tier key, in the registry shape', () => {
    const parsed = parseLaneEnv(
      renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY),
    );

    expect(parsed.WEB_TIER_KEY).toBe(WEB_TIER_KEY);
    expect(LANE_WEB_TIER_KEY_SHAPE.test(parsed.WEB_TIER_KEY ?? '')).toBe(true);
  });

  it('writes every storage row from the lane storage branch, never a local default', () => {
    const parsed = parseLaneEnv(
      renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY),
    );

    for (const key of LANE_STORAGE_KEYS) {
      expect(parsed[key]).toBe(laneStorageFixture[key]);
    }

    expect(parsed.STORAGE_ENDPOINT).not.toContain('localhost');
  });

  it('points the web app at this lane own API port', () => {
    const parsed = parseLaneEnv(
      renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY),
    );
    expect(parsed.NEXT_PUBLIC_API_URL).toBe('http://localhost:4007');
    expect(parsed.PORT).toBe('4007');
    expect(parsed.WEB_PORT).toBe('3007');
  });

  /**
   * The server-side twin, and the one that fails **silently**.
   *
   * `apps/web/src/lib/api-client.ts` reads `process.env.API_URL` for every
   * Server Component fetch; `NEXT_PUBLIC_API_URL` above only reaches the
   * browser bundle. Writing the public one alone leaves the root `.env`'s
   * `http://localhost:4000` in force, so a lane's pages render against another
   * checkout's API — which produced a 500 on every `/admin/*` route in lane
   * 432 and read as a defect in the change under test.
   */
  it('points server-side fetches at this lane own API too, not just the browser', () => {
    const parsed = parseLaneEnv(
      renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY),
    );
    expect(parsed.API_URL).toBe('http://localhost:4007');
    expect(parsed.API_URL).toBe(parsed.NEXT_PUBLIC_API_URL);
  });

  it('lets the API accept this lane own web origin, so a browser can drive it', () => {
    const parsed = parseLaneEnv(
      renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY),
    );
    // `allowedOrigins()` splits WEB_URL; without it the lane refuses its own
    // web app and every client-side call fails CORS.
    expect(parsed.WEB_URL).toBe('http://localhost:3007');
  });

  it('points the database at this lane own database', () => {
    const parsed = parseLaneEnv(
      renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY),
    );
    expect(parsed.DATABASE_URL).toBe(databaseUrl);
  });

  it('never writes the Neon-only variables, which must stay unset locally', () => {
    // The env registry marks both optional for `local`; setting them against
    // the Docker container fails `pnpm preflight` on a correct configuration.
    const parsed = parseLaneEnv(
      renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY),
    );
    expect(parsed.DATABASE_URL_UNPOOLED).toBeUndefined();
    expect(parsed.NEON_BRANCH).toBeUndefined();
  });
});

/**
 * `cp .env.example .env` writes `https://...@sentry.io/...` into both DSN rows,
 * the API refuses to boot on it (the shape check calls it "not a real value"),
 * and a lane inherits that `.env`. The lane file wins over an inherited value
 * and the schemas read an empty one as absent, so blank is "Sentry off".
 */
describe('a lane runs with Sentry off', () => {
  const placeholder = 'https://...@sentry.io/...';

  it('blanks both DSN rows so the root .env placeholder cannot reach the lane', () => {
    const parsed = parseLaneEnv(
      renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY),
    );
    expect(parsed.SENTRY_DSN).toBe('');
    expect(parsed.NEXT_PUBLIC_SENTRY_DSN).toBe('');
  });

  it('overrides an inherited placeholder in the child environment', () => {
    const base = { SENTRY_DSN: placeholder, NEXT_PUBLIC_SENTRY_DSN: placeholder };
    const env = laneChildEnv(
      base,
      renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY),
      ['pnpm', 'dev'],
    );
    expect(env.SENTRY_DSN).toBe('');
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBe('');
  });

  it('leaves the upload token to the root .env, which only a production build reads', () => {
    expect(
      parseLaneEnv(renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY))
        .SENTRY_AUTH_TOKEN,
    ).toBeUndefined();
  });
});

describe('parseLaneEnv', () => {
  it('ignores comments and blank lines', () => {
    expect(parseLaneEnv('# a comment\n\nPORT=4007\n')).toEqual({ PORT: '4007' });
  });

  it('keeps everything after the first equals sign', () => {
    expect(parseLaneEnv('DATABASE_URL=postgresql://h.invalid/db?a=b')).toEqual({
      DATABASE_URL: 'postgresql://h.invalid/db?a=b',
    });
  });
});

describe('childEnv', () => {
  it('lets the lane file win over an inherited value of the same name', () => {
    expect(childEnv({ PORT: '4000' }, 'PORT=4007').PORT).toBe('4007');
  });

  it('preserves inherited variables the lane file does not mention', () => {
    expect(childEnv({ HOME: '/home/dev' }, 'PORT=4007').HOME).toBe('/home/dev');
  });
});

/**
 * `PORT` in the lane file is the **API's** port, and `lane:exec` handed it to
 * every child. `next start` reads `PORT`, so a lane's web app bound the lane's
 * API port: the web port refused connections and read as a broken app, while
 * the API port served the app and read as a correct one. Neither direction says
 * anything is wrong. `next dev` escaped only because `apps/web`'s dev script
 * passes `--port $WEB_PORT` explicitly, which is a property of one script
 * rather than of the lane.
 */
describe('laneChildEnv', () => {
  const contents = renderLaneEnv(manifest, databaseUrl, laneStorageFixture, WEB_TIER_KEY);

  it('gives a command that serves the web app the lane web port', () => {
    const web = ['pnpm', '--filter', '@vendor-marketplace/web', 'start'];
    expect(laneChildEnv({}, contents, web).PORT).toBe('3007');
    expect(laneChildEnv({}, contents, ['pnpm', '-C', 'apps/web', 'start']).PORT).toBe('3007');
    expect(laneChildEnv({}, contents, ['npx', 'next', 'start']).PORT).toBe('3007');
    expect(laneChildEnv({}, contents, ['node_modules/.bin/next', 'start']).PORT).toBe('3007');
  });

  it('leaves the API port in place for the API', () => {
    const api = ['pnpm', '--filter', '@vendor-marketplace/api', 'start'];
    expect(laneChildEnv({}, contents, api).PORT).toBe('4007');
  });

  /*
   * A root `pnpm dev` or `pnpm build` fans out across both apps, and the only
   * process in that fan-out reading `PORT` is the API — `apps/web`'s dev script
   * passes its own `--port`. Re-pointing `PORT` there would move the API onto
   * the web port, which is the same defect in the other direction.
   */
  it('leaves the API port in place for a command that runs both apps', () => {
    expect(laneChildEnv({}, contents, ['pnpm', 'dev']).PORT).toBe('4007');
    expect(laneChildEnv({}, contents, ['pnpm', 'build']).PORT).toBe('4007');

    const both = ['turbo', 'run', 'start', '--filter=./apps/web', '--filter=./apps/api'];
    expect(laneChildEnv({}, contents, both).PORT).toBe('4007');
  });

  it('overrides only PORT, leaving every other lane value alone', () => {
    const child = laneChildEnv({ HOME: '/home/dev' }, contents, ['npx', 'next', 'start']);
    expect(child.WEB_PORT).toBe('3007');
    expect(child.API_URL).toBe('http://localhost:4007');
    expect(child.DATABASE_URL).toBe(databaseUrl);
    expect(child.HOME).toBe('/home/dev');
  });

  it('still lets the lane file win over an inherited PORT', () => {
    expect(laneChildEnv({ PORT: '4000' }, contents, ['pnpm', 'dev']).PORT).toBe('4007');
  });
});
