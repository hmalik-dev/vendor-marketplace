import { deploymentPlatform } from '@vendor-marketplace/shared/env';
import { isIP } from 'node:net';

const REAL_IP_HEADER = 'x-real-ip';

/**
 * The address a rate limit counts a caller by.
 *
 * On Railway the API sits behind an edge that sets `X-Real-IP` to the address
 * it accepted the connection from. `request.ip` is wrong there: it is the edge
 * node's address (or the last `X-Forwarded-For` entry, which an edge node
 * appends), so every caller behind one node shared a bucket and one caller got
 * a bucket per node (VEN-549).
 *
 * The header is read only when the platform is Railway, not merely when
 * `NODE_ENV=production`: the same container reachable any other way (a private
 * network, a published port, another host) has no edge writing the header, and
 * trusting it there would let a caller name a fresh bucket per request.
 * Anywhere else, and for a value that is not exactly one address, the socket
 * address wins, and a deployed process says so once per call site's failure
 * through `log`, because a silent fallback is the shared bucket again.
 */
export function clientAddress(request: {
  ip: string;
  headers: Record<string, string | string[] | undefined>;
  log?: { warn: (message: string) => void };
}): string {
  if (deploymentPlatform()?.platform !== 'Railway') {
    return request.ip;
  }
  const value = request.headers[REAL_IP_HEADER];
  if (typeof value === 'string' && isIP(value) !== 0) {
    return value;
  }
  request.log?.warn('x-real-ip missing or malformed on Railway: rate limit keyed on the socket');
  return request.ip;
}
