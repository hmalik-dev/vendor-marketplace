import { describe, expect, it } from 'vitest';
import { E2E_VENDOR_INVITE_ONLY_KEY, readVendorInviteOnlyFlag } from './e2e-vendor-invite-flag.js';

describe('readVendorInviteOnlyFlag', () => {
  it('is undefined when the variable is unset, so a re-seed leaves the switch alone', () => {
    expect(readVendorInviteOnlyFlag({})).toBeUndefined();
  });

  it('reads "true" as on', () => {
    expect(readVendorInviteOnlyFlag({ [E2E_VENDOR_INVITE_ONLY_KEY]: 'true' })).toBe(true);
  });

  it('reads "false" as off, not as unset', () => {
    expect(readVendorInviteOnlyFlag({ [E2E_VENDOR_INVITE_ONLY_KEY]: 'false' })).toBe(false);
  });

  it('refuses anything else by name, rather than silently defaulting', () => {
    expect(() => readVendorInviteOnlyFlag({ [E2E_VENDOR_INVITE_ONLY_KEY]: '1' })).toThrow(
      `${E2E_VENDOR_INVITE_ONLY_KEY} must be "true" or "false" if set, not 1.`,
    );
    expect(() => readVendorInviteOnlyFlag({ [E2E_VENDOR_INVITE_ONLY_KEY]: '' })).toThrow(
      /must be "true" or "false"/,
    );
    expect(() => readVendorInviteOnlyFlag({ [E2E_VENDOR_INVITE_ONLY_KEY]: 'TRUE' })).toThrow(
      /must be "true" or "false"/,
    );
  });
});
