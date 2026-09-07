import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { UserRole } from '@vendor-marketplace/shared';
import { ApiClientError, apiRequest } from './api-client';
import { isNavigationSignal } from './navigation-signal';
import { requestedPath } from './requested-path';
import { RETURN_PATH_PARAM, safeReturnPath, signInPathReturningTo } from './return-path';
import { redirectIfTermsRequired } from './terms-gate';
/*
 * The role→route tables live in `role-routes.ts`, beside the table saying which
 * roles each route renders for: one place computes a role's destination, and a
 * bounce target the role would itself be bounced out of is a loop (#410).
 */
import { DASHBOARD_PATH_BY_ROLE } from './role-routes';
import { wireUserSchema, type WireUser } from './wire-schemas';

/**
 * Loads the caller's profile from the API. Server Components only — it reads
 * the Clerk session on the server and never ships a token to the browser.
 * Returns `null` when nobody is signed in or the session no longer resolves to
 * an account, which is the caller's cue to send them to sign-in.
 *
 * `cache()` because a single render asks more than once: the root layout's
 * header reads the role for its user menu, and a page underneath it reads the
 * same record for its own reasons — the vendor storefront, for one, to decide
 * whether its two CTAs are offered at all. Without this each of those is its
 * own `/users/me` round trip on the request's critical path, for one record
 * that cannot change between them. Per-request and server-only, so nothing is
 * shared between two visitors.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<WireUser | null> {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    return null;
  }

  try {
    return await apiRequest('/users/me', { schema: wireUserSchema, token });
  } catch (error) {
    if (error instanceof ApiClientError && (error.statusCode === 401 || error.statusCode === 404)) {
      return null;
    }
    throw error;
  }
});

/**
 * Loads the caller and sends them somewhere sensible when there is no usable
 * session. Role is read from the local database record, never from Clerk
 * metadata.
 */
export async function requireCurrentUser(returnTo?: string): Promise<WireUser> {
  const user = await getCurrentUserOrSuspend();

  if (!user) {
    /*
     * The destination travels with the redirect so signing in resumes the
     * thing the customer was doing. A caller that knows its own URL exactly —
     * including the query carrying a chosen package and date — passes it, and
     * that wins; everything else falls back to the path the middleware stamped
     * on the request, which is the only thing a *layout* can go on.
     * `signInPathReturningTo` drops anything that is not a same-origin path, so
     * neither route can widen this into an open redirect by accident.
     */
    redirect(signInPathReturningTo(returnTo ?? (await requestedPath())));
  }

  return user;
}

/**
 * `getCurrentUser` with the suspended-account case turned into a redirect.
 * A suspended account is a distinct case from a signed-out one: the API answers
 * it with 403, and letting that error reach the render turns the page into a
 * raw 500.
 */
async function getCurrentUserOrSuspend(): Promise<WireUser | null> {
  try {
    return await getCurrentUser();
  } catch (error) {
    /*
     * The acceptance gate is a 403 too, and it is a different instruction: an
     * account that has not accepted the current Terms is one tick from usable,
     * while a suspension is terminal. Answering both with `/suspended` would
     * tell every new account it had been banned. Checked first, because the
     * status alone cannot tell them apart — only the code can.
     */
    await redirectIfTermsRequired(error);
    if (error instanceof ApiClientError && error.statusCode === 403) {
      redirect('/suspended');
    }
    throw error;
  }
}

/**
 * Loads the caller and bounces them to their own dashboard if they hold a
 * different role, so `/vendor/*` and `/customer/*` stay separated.
 *
 * The role bounce deliberately ignores `returnTo`: a customer who reached a
 * vendor-only route does not become entitled to it by signing in, so they land
 * on their own home rather than back on the route they were refused.
 */
export async function requireRole(role: UserRole, returnTo?: string): Promise<WireUser> {
  const user = await requireCurrentUser(returnTo);

  if (user.role !== role) {
    redirect(DASHBOARD_PATH_BY_ROLE[user.role]);
  }

  return user;
}

/**
 * Guards the authentication pages. Somebody who already holds a session has
 * nothing to do on sign-in or sign-up, so send them to `/after-sign-in`, which
 * resolves the role from the local record and forwards on.
 *
 * The destination has to travel with them. Signing in in another tab and then
 * reloading a `/sign-in?returnTo=…` page takes this branch rather than the
 * form, and dropping the parameter here put the visitor on their role's
 * default start with the thing they were doing lost — the exact failure the
 * `returnTo` round trip exists to prevent.
 */
export async function redirectIfSignedIn(returnTo?: string | null): Promise<void> {
  const { userId } = await auth();

  if (!userId) {
    return;
  }

  const safe = safeReturnPath(returnTo);

  redirect(
    safe ? `/after-sign-in?${RETURN_PATH_PARAM}=${encodeURIComponent(safe)}` : '/after-sign-in',
  );
}

/**
 * The role, for chrome that **decorates** rather than gates.
 *
 * `SiteHeader` renders in the root layout, so it runs on every route — public
 * and protected, signed in and out. A throw there is not catchable by any
 * `error.tsx`: only `global-error.tsx` sees it, and that replaces the whole
 * document. `getCurrentUser` swallows 401 and 404 and propagates everything
 * else, so a 403, a 500 or an unreachable API would have taken every page in
 * the product down to the global error screen — including `/suspended`, which
 * a banned account is redirected *to* and whose own read answers 403.
 *
 * That is the regression #33 already fixed once for signed-out visitors; this
 * read is what would have reintroduced it for signed-in ones.
 *
 * Degrading is safe **here specifically** because the value decorates: an
 * unreadable record costs the vendor chip and nothing else. It is not a gate.
 * Protected routes still call `requireRole`, which propagates, so nothing
 * fails open. Never reach for this where the answer is load-bearing.
 *
 * Unlike `readIdentityOnPublicRoute` it does not redirect a suspended account:
 * the header runs on `/suspended` too, and redirecting from there would loop.
 */
export async function readRoleForChrome(): Promise<UserRole | null> {
  try {
    return (await getCurrentUser())?.role ?? null;
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }

    return null;
  }
}

/**
 * Identity on a route that is **declared public** — never inferred from where a
 * `try/catch` happens to sit.
 *
 * On a public route the identity read buys a convenience and nothing more: the
 * page's content is the same for everyone, so an unreadable user record costs
 * the vendor redirect and the user menu rather than the page. #33 made the
 * public routes render for signed-out visitors during an outage; a signed-in
 * one still got the 500 boundary on `/`, because this read propagated.
 *
 * **This must never be used on a protected route.** There the read is
 * load-bearing — the role gate and the suspension gate both hang off it — and
 * degrading it would fail open, which is a security defect rather than a
 * smaller page. `requireCurrentUser` is the protected-route path and it still
 * propagates.
 *
 * A `redirect()` is not a failure: a suspended account still reaches
 * `/suspended` when the API is answering, because the suspension is a 403 the
 * API returned rather than an API that could not be reached.
 */
async function readIdentityOnPublicRoute(): Promise<WireUser | null> {
  try {
    return await getCurrentUserOrSuspend();
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }

    return null;
  }
}

/**
 * Identity for `/support`, which must never redirect anybody away from itself.
 *
 * Every other read in this file sends a suspended account to `/suspended`, and
 * that is right for every other surface. It is wrong for exactly this one:
 * `/suspended` renders the marketing footer, the footer carries
 * `Contact support`, and routing that click through a suspension redirect
 * lands the visitor back on `/suspended`. A banned account arguing it was
 * banned in error is the clearest case there is for a contact form, and the
 * link would have been a loop for precisely them.
 *
 * So a suspended account is read the way a signed-out one is: the screen shows
 * the email field and asks for an address, rather than naming an account it
 * has just refused. An unreachable API degrades the same way, which matters
 * here more than anywhere — this is the page a visitor reaches to report that
 * the API is unreachable.
 */
export async function readIdentityForSupport(): Promise<WireUser | null> {
  try {
    return await getCurrentUser();
  } catch {
    /*
     * No `isNavigationSignal` re-throw, unlike its neighbours: `getCurrentUser`
     * never redirects — it swallows 401 and 404 and propagates the rest — so
     * there is no navigation to preserve, and catching everything is the whole
     * point rather than an oversight.
     */
    return null;
  }
}

/**
 * Guards the root page. `/` is the customer-facing browse surface, and a vendor
 * has no use for a catalogue of other vendors — their home is their own
 * dashboard. Signed-out visitors and customers fall through and see the page.
 *
 * `/` is public, so an unreadable record skips the redirect rather than failing
 * the page — the visitor gets the marketplace with signed-out chrome.
 */
export async function redirectVendorToDashboard(): Promise<void> {
  const user = await readIdentityOnPublicRoute();

  if (user?.role === 'vendor') {
    redirect(DASHBOARD_PATH_BY_ROLE.vendor);
  }
}
