import { headers } from 'next/headers';
import { CSP_NONCE_HEADER } from '@/config/security-headers';

/**
 * This request's CSP nonce, as `middleware.ts` minted it, for a `<script>` a
 * server component renders itself. Undefined outside a request (a unit test),
 * where no policy is in force either.
 */
export async function cspNonce(): Promise<string | undefined> {
  try {
    return (await headers()).get(CSP_NONCE_HEADER) ?? undefined;
  } catch {
    return undefined;
  }
}
