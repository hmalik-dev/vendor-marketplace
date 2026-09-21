import { deploymentPlatform } from '@vendor-marketplace/shared/env';

const PLATFORM_ADDRESS_HEADER = 'x-real-ip';
const FORWARDED_FOR_HEADER = 'x-forwarded-for';

/**
 * The address the web tier counts a visitor by, for the sign-in throttle and
 * for the address it vouches to the API. One rule, so the two never disagree
 * (VEN-520), and the same rule the API applies to its own callers (VEN-549).
 *
 * On Vercel the edge overwrites `X-Real-IP` with the address it accepted the
 * connection from, so that wins. It is read only on Vercel, for the reason the
 * API reads its own only on Railway: anywhere else nothing overwrites it and a
 * caller could name a fresh bucket per request.
 *
 * Otherwise the **rightmost** `X-Forwarded-For` entry, the one the nearest
 * proxy appended. The leftmost is whatever the caller wrote, and keying on it
 * hands the limit back to the caller being limited.
 */
export function visitorAddress(headers: Headers): string | null {
  if (deploymentPlatform()?.platform === 'Vercel') {
    const platform = headers.get(PLATFORM_ADDRESS_HEADER)?.trim();
    if (platform) {
      return platform;
    }
  }
  return headers.get(FORWARDED_FOR_HEADER)?.split(',').at(-1)?.trim() || null;
}
