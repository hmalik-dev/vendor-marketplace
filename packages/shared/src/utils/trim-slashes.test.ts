import { describe, expect, it } from 'vitest';
import { EXPLICIT_ORIGIN, deploymentOrigin } from '../env/deployment.js';
import { expectLinearTime } from '../test-support/linear-time.js';
import { toObjectKey, trimTrailingSlashes } from './index.js';

const hostile = (size: number) => `${'/'.repeat(size)}x`;

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

  it('leaves a long run of slashes that does not end the string as it is', () => {
    expect(trimTrailingSlashes(hostile(1024))).toBe(hostile(1024));
    expect(toObjectKey(hostile(1024), 'k')).toBe('k');
    expect(deploymentOrigin({ [EXPLICIT_ORIGIN]: hostile(1024) })).toBe(`https://${hostile(1024)}`);
  });

  it('finishes in linear time on a long run of slashes that does not end the string', () => {
    expectLinearTime(hostile, trimTrailingSlashes);
  });

  it('keeps toObjectKey linear on a hostile base', () => {
    expectLinearTime(hostile, (base) => toObjectKey(base, 'k'));
  });

  it('keeps the deployment origin resolver linear on a hostile host', () => {
    expectLinearTime(hostile, (host) => deploymentOrigin({ [EXPLICIT_ORIGIN]: host }));
  });
});
