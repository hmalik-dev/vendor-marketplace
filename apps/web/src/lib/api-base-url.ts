import { API_VERSION_PREFIX } from '@vendor-marketplace/shared';
import { apiOrigin } from '@/config/public-env';

/**
 * Where the API's routes are: its origin and the version prefix every route
 * but the probes and the webhooks is served under (VEN-650). Every call this
 * app makes is built on it, so the version is one constant.
 *
 * Here rather than in `config/public-env`, which stays a leaf that imports
 * nothing.
 *
 * @param serverFallback as for `apiOrigin`.
 */
export function apiBaseUrl(serverFallback?: string): string {
  return `${apiOrigin(serverFallback)}${API_VERSION_PREFIX}`;
}
