import type { Redirect } from 'next/dist/lib/load-custom-routes';

/**
 * Paths that moved. `permanent` answers 308, which keeps the method. The console
 * page for admins was `/admin/operators` before VEN-696; a bookmark or an old
 * email link still lands on it. The API path is not kept: web and API deploy together.
 */
export const LEGACY_REDIRECTS: readonly Redirect[] = [
  { source: '/admin/operators', destination: '/admin/admins', permanent: true },
];
