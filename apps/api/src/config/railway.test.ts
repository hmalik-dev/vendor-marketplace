import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RAILWAY_CONFIG = fileURLToPath(new URL('../../../../railway.json', import.meta.url));

/*
 * Stream tickets, the sign-in throttle, the rate-limit counters and the payout
 * and expiry timers' overlap guards all live in one process's memory
 * (docs/pre-launch.md, "Deploy constraints"). A second replica splits every one
 * of them. Delete this test in the pull request that closes VEN-462, which moves
 * that state out of the process.
 */
describe('railway.json', () => {
  it('runs exactly one API replica while state is per-process', () => {
    const config = JSON.parse(readFileSync(RAILWAY_CONFIG, 'utf8')) as {
      deploy?: { numReplicas?: number };
    };

    expect(config.deploy?.numReplicas).toBe(1);
  });
});
