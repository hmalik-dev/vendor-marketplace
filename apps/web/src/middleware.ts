import { clerkMiddleware } from '@clerk/nextjs/server';

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
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
