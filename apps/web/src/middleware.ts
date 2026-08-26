import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Everything behind a dashboard requires a session. Role separation is decided
 * one layer in, by the `/customer` and `/vendor` layouts, because it depends on
 * the local `users.role` column rather than on Clerk metadata.
 */
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/customer(.*)', '/vendor(.*)']);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
