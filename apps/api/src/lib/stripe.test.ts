import { describe, expect, it } from 'vitest';
import { isOnboarded, onboardingReturnOrigin } from './stripe.js';

describe('isOnboarded', () => {
  it('requires both capabilities, not either', () => {
    expect(isOnboarded({ transfersActive: true, payoutsActive: true })).toBe(true);
    expect(isOnboarded({ transfersActive: true, payoutsActive: false })).toBe(false);
    expect(isOnboarded({ transfersActive: false, payoutsActive: true })).toBe(false);
    expect(isOnboarded({ transfersActive: false, payoutsActive: false })).toBe(false);
  });
});

describe('onboardingReturnOrigin', () => {
  it('takes the first origin, because WEB_URL is also the CORS allow-list', () => {
    expect(
      onboardingReturnOrigin({
        WEB_URL: 'https://orla.example, https://www.orla.example',
        NODE_ENV: 'production',
      }),
    ).toBe('https://orla.example');
  });

  it('strips a trailing slash so the joined path never doubles up', () => {
    expect(
      onboardingReturnOrigin({ WEB_URL: 'http://localhost:3000/', NODE_ENV: 'development' }),
    ).toBe('http://localhost:3000');
  });

  it('allows a plaintext localhost origin outside production', () => {
    // Stripe accepts http://localhost in test mode, and that is the only reason
    // the redirect leg can be driven in a browser locally at all.
    expect(
      onboardingReturnOrigin({ WEB_URL: 'http://localhost:3038', NODE_ENV: 'development' }),
    ).toBe('http://localhost:3038');
  });

  /*
   * The development default must not be able to reach production. A deployment
   * misconfigured to a plaintext origin would otherwise send every vendor
   * through hosted onboarding and back over http, and nothing would say so.
   */
  it('refuses a plaintext origin in production rather than returning vendors over http', () => {
    expect(() =>
      onboardingReturnOrigin({ WEB_URL: 'http://orla.example', NODE_ENV: 'production' }),
    ).toThrow(/https/);
  });

  it('refuses an empty WEB_URL rather than minting a link to nowhere', () => {
    expect(() => onboardingReturnOrigin({ WEB_URL: '', NODE_ENV: 'development' })).toThrow(
      /WEB_URL/,
    );
  });
});
