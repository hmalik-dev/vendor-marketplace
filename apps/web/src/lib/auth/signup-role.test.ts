import { afterEach, describe, expect, it } from 'vitest';
import { readSignUpRole, rememberSignUpRole, SIGN_UP_ROLE_KEY } from './signup-role';

afterEach(() => window.localStorage.clear());

describe('readSignUpRole', () => {
  it('reads the role only for the address it was remembered for', () => {
    rememberSignUpRole('vendor', 'ada@example.com');

    expect(readSignUpRole('ada@example.com')).toBe('vendor');
    expect(readSignUpRole('grace@example.com')).toBeNull();
  });

  it('matches a stored address that differs only in case and surrounding space', () => {
    window.localStorage.setItem(
      SIGN_UP_ROLE_KEY,
      JSON.stringify({ role: 'vendor', email: '  Ada@Example.COM ', at: Date.now() }),
    );

    expect(readSignUpRole(' ADA@example.com')).toBe('vendor');
  });

  it('is absent for an entry with no address or a non-string one', () => {
    window.localStorage.setItem(
      SIGN_UP_ROLE_KEY,
      JSON.stringify({ role: 'vendor', at: Date.now() }),
    );
    expect(readSignUpRole('ada@example.com')).toBeNull();

    window.localStorage.setItem(
      SIGN_UP_ROLE_KEY,
      JSON.stringify({ role: 'vendor', email: 42, at: Date.now() }),
    );
    expect(readSignUpRole('ada@example.com')).toBeNull();
  });
});
