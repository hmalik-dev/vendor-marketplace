import { describe, expect, it } from 'vitest';
import { EXPLICIT_ORIGIN, deploymentOrigin } from '../env/deployment.js';
import { toObjectKey, trimTrailingSlashes } from './index.js';

const HOSTILE = `${'/'.repeat(64 * 1024)}x`;
const BUDGET_MS = 50;

function elapsed(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe('trimTrailingSlashes', () => {
  it.each([
    ['https://cdn.example.test', 'https://cdn.example.test'],
    ['https://cdn.example.test/', 'https://cdn.example.test'],
    ['https://cdn.example.test///', 'https://cdn.example.test'],
    ['/a/b/', '/a/b'],
    ['///', ''],
    ['', ''],
  ])('trims %j to %j', (input, expected) => {
    expect(trimTrailingSlashes(input)).toBe(expected);
  });

  it('finishes in linear time on a long run of slashes that does not end the string', () => {
    expect(trimTrailingSlashes(HOSTILE)).toBe(HOSTILE);
    expect(elapsed(() => trimTrailingSlashes(HOSTILE))).toBeLessThan(BUDGET_MS);
  });

  it('keeps toObjectKey linear on a hostile base', () => {
    expect(toObjectKey(HOSTILE, 'k')).toBe('k');
    expect(elapsed(() => toObjectKey(HOSTILE, 'k'))).toBeLessThan(BUDGET_MS);
  });

  it('keeps the deployment origin resolver linear on a hostile host', () => {
    const source: NodeJS.ProcessEnv = { [EXPLICIT_ORIGIN]: HOSTILE };

    expect(deploymentOrigin(source)).toBe(`https://${HOSTILE}`);
    expect(elapsed(() => deploymentOrigin(source))).toBeLessThan(BUDGET_MS);
  });
});
