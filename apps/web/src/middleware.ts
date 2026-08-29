import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { REQUEST_PATH_HEADER } from '@/lib/return-path';

/**
 * Attaches the Clerk session to every request. Route protection is deliberately
 * *not* done here: Clerk deprecated path-matcher guards because a matcher can
 * diverge from how Next.js actually routes a request and leave a protected
 * resource reachable.
 *
 * Instead each protected resource checks for itself — the `/customer` and
 * `/vendor` layouts call `requireRole`, and `/dashboard` resolves the caller
 * before redirecting. Both read the local `users.role` column, which is the
 * only trustworthy source anyway.
 *
 * It also stamps the requested path onto the request headers, which is the only
 * way a *layout* can send a signed-out visitor back where they were going: a
 * layout renders above the page and cannot be told the child's URL. Pages that
 * know their own destination exactly still pass it explicitly and win over this.
 *
 * The header is **set, never merged** — `headers.set` overwrites whatever the
 * client sent under the same name, so a visitor cannot seed their own value.
 * It is still re-validated by `safeReturnPath` before it reaches a redirect,
 * because a header being ours does not make its contents a safe path.
 */
/**
 * Next's own client-navigation cache-buster. It is not part of the destination,
 * and carrying it through sign-in would land the visitor on
 * `/vendor/dashboard?_rsc=abc123` — a URL they never asked for.
 */
const INTERNAL_QUERY_PARAMS = ['_rsc'] as const;

export default clerkMiddleware((_auth, request) => {
  const destination = new URL(request.nextUrl);
  for (const param of INTERNAL_QUERY_PARAMS) {
    destination.searchParams.delete(param);
  }

  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, `${destination.pathname}${destination.search}`);

  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
