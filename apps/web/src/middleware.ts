import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { CSP_NONCE_HEADER, withNonce } from '@/config/security-headers';
import { REQUEST_PATH_HEADER } from '@/lib/return-path';

/**
 * Route protection is deliberately *not* done here: a path-matcher guard can
 * diverge from how Next.js actually routes a request and leave a protected
 * resource reachable.
 *
 * Instead each protected resource checks for itself — the `/customer` and
 * `/vendor` layouts call `requireRole`, and `/dashboard` resolves the caller
 * before redirecting. Both read the local `users.role` column, which is the
 * only trustworthy source anyway.
 *
 * It stamps the requested path onto the request headers, which is the only
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

/**
 * A fresh, unguessable nonce per request. `randomUUID` is a CSPRNG in the edge
 * runtime and in Node; base64 keeps it inside the CSP nonce grammar.
 */
function newNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * The policy and the header it travels in are built by `next.config.ts` and
 * inlined at build. A build without them would ship no CSP at all, so this
 * throws rather than quietly serving unprotected pages.
 */
function policyFor(nonce: string): { name: string; value: string } {
  const template = process.env.CSP_TEMPLATE;
  const name = process.env.CSP_HEADER_NAME;

  if (!template || !name) {
    throw new Error(
      'CSP_TEMPLATE and CSP_HEADER_NAME are inlined by next.config.ts and are unset.',
    );
  }

  return { name, value: withNonce(template, nonce) };
}

export default function middleware(request: NextRequest): NextResponse {
  const destination = new URL(request.nextUrl);
  for (const param of INTERNAL_QUERY_PARAMS) {
    destination.searchParams.delete(param);
  }

  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, `${destination.pathname}${destination.search}`);

  /*
   * Set on the *request* as well as the response: Next reads the nonce out of
   * the request's CSP header and stamps it on its own inline scripts. Both
   * headers are overwritten, so a client cannot supply a nonce of its own.
   */
  const nonce = newNonce();
  const policy = policyFor(nonce);
  // Always the enforcing name on the request: Next takes the nonce from that
  // one, so a report-only environment would otherwise render nonce-less scripts.
  headers.set('Content-Security-Policy', policy.value);
  headers.set(CSP_NONCE_HEADER, nonce);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set(policy.name, policy.value);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
