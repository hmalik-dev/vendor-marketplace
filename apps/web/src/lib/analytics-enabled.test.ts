import { describe, expect, it } from 'vitest';
import { analyticsEnabled } from './analytics-enabled';

/** Only production reports; every other value, and unset, sends nothing. */
describe('analyticsEnabled', () => {
  it.each([
    ['production', true],
    ['preview', false],
    ['development', false],
    [undefined, false],
  ])('for VERCEL_ENV=%s answers %s', (vercelEnv, expected) => {
    expect(analyticsEnabled(vercelEnv)).toBe(expected);
  });
});
