import { beforeEach, describe, expect, it } from 'vitest';
import { callerAddress, isThrottled, resetThrottle } from './proxy-throttle';

const VERIFY = ['email-otp', 'verify-email'];

describe('isThrottled', () => {
  beforeEach(resetThrottle);

  it('lets ten code guesses a minute through and refuses the eleventh', () => {
    const results = Array.from({ length: 11 }, () => isThrottled('1.2.3.4', VERIFY, 1_000));

    expect(results.slice(0, 10)).toEqual(Array(10).fill(false));
    expect(results[10]).toBe(true);
  });

  it('budgets each caller separately', () => {
    for (let i = 0; i < 11; i++) isThrottled('1.2.3.4', VERIFY, 1_000);

    expect(isThrottled('5.6.7.8', VERIFY, 1_000)).toBe(false);
  });

  it('forgives a caller once the minute has passed', () => {
    for (let i = 0; i < 11; i++) isThrottled('1.2.3.4', VERIFY, 1_000);

    expect(isThrottled('1.2.3.4', VERIFY, 61_001)).toBe(false);
  });

  it('gives the untargeted calls a looser budget of sixty', () => {
    const results = Array.from({ length: 61 }, () =>
      isThrottled('1.2.3.4', ['get-session'], 1_000),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results[60]).toBe(true);
  });
});

describe('callerAddress', () => {
  it('takes the first hop of x-forwarded-for', () => {
    expect(callerAddress(new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('9.9.9.9');
  });

  it('falls back to one shared bucket when the header is absent', () => {
    expect(callerAddress(new Headers())).toBe('unknown');
  });
});
