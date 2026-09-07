import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ApiClientError, apiRequest } from './api-client';
import { signInPathReturningHere } from './requested-path';
import { wireTermsAcceptanceStatusSchema, type WireTermsAcceptanceStatus } from './wire-schemas';

/**
 * The acceptance gate's own read, and the one server read in this app that must
 * **not** be routed through the gate.
 *
 * Every other protected read turns a `TERMS_REQUIRED` into a redirect to the
 * interstitial. This one is the interstitial's, so doing that would be a loop:
 * `GET /legal/terms` is one of the two routes an un-accepted session is allowed
 * to reach, precisely so this screen can render for somebody who has accepted
 * nothing and has no account row yet.
 */
export async function getTermsStatus(): Promise<WireTermsAcceptanceStatus> {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    redirect(await signInPathReturningHere());
  }

  try {
    return await apiRequest('/legal/terms', {
      schema: wireTermsAcceptanceStatusSchema,
      token,
    });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 401) {
      redirect(await signInPathReturningHere());
    }

    /*
     * A suspended account reaches this screen two ways — typing the URL, or
     * sitting at the gate when an operator bans it and reloading. The auth
     * plugin refuses it before any route runs, including this one, and letting
     * that 403 reach the render turns the page into the error boundary.
     * `web-route-boundaries.md` puts a 403 on the suspended surface, not there.
     */
    if (error instanceof ApiClientError && error.statusCode === 403) {
      redirect('/suspended');
    }

    throw error;
  }
}
