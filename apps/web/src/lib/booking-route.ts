import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { uuidSchema } from '@vendor-marketplace/shared';
import { requireRole } from './current-user';
import { getBookingForRequest, getOwnBookingRequest, openCheckout } from './customer-data';

/**
 * The status decisions of `/bookings/[requestId]` and its two children, made
 * where they can still be a status (VEN-715).
 *
 * Each route has a `loading.tsx`, which is a Suspense boundary: everything
 * inside it streams after the 200 shell has flushed, so a `notFound()`,
 * `redirect()` or session gate in the page would go out as a soft 404 or a meta
 * refresh under HTTP 200. A layout renders above that boundary, so the layouts
 * call the `gate…` functions below and answer 404 / 307 for real, and the page
 * reads the same data back through the `cache()`d readers — one round trip per
 * request, however many components ask.
 */
export const readBookingRequest = cache(getOwnBookingRequest);
export const readBookingForRequest = cache(getBookingForRequest);
/** Opening checkout mints a payment intent, so the layout and the page must share one call. */
export const openCheckoutOnce = cache(openCheckout);

interface RouteParams {
  params: Promise<{ requestId: string }>;
}

/**
 * The id, or a 404. Parsed before it reaches a query: the URL is pasteable,
 * and an id the API cannot parse is an identifier that cannot exist.
 */
async function parseRequestId({ params }: RouteParams): Promise<string> {
  const parsed = uuidSchema.safeParse((await params).requestId);

  if (!parsed.success) {
    notFound();
  }

  return parsed.data;
}

/** The page's half: the id the layout already accepted. */
export async function acceptedRequestId({ params }: RouteParams): Promise<string> {
  return uuidSchema.parse((await params).requestId);
}

/** What the layout let through cannot be missing; a `null` here is a bug, not a 404. */
export async function acceptedRequest(
  requestId: string,
): Promise<NonNullable<Awaited<ReturnType<typeof readBookingRequest>>>> {
  const request = await readBookingRequest(requestId);

  if (request === null) {
    throw new Error('Booking request vanished between its layout and its page');
  }

  return request;
}

/**
 * The customer gate, then the request itself. Missing and not-yours arrive
 * identically — the API answers a stranger with a 404 — so both are `notFound()`.
 */
export async function gateBookingRequest(route: RouteParams): Promise<string> {
  await requireRole('customer');
  const requestId = await parseRequestId(route);

  if ((await readBookingRequest(requestId)) === null) {
    notFound();
  }

  return requestId;
}

/** Frame `06`'s gate: a request that is not paid yet goes back to checkout. */
export async function gateConfirmedBooking(route: RouteParams): Promise<string> {
  const requestId = await gateBookingRequest(route);

  if ((await readBookingForRequest(requestId)) === null) {
    redirect(`/bookings/${requestId}/checkout`);
  }

  return requestId;
}

/**
 * Frame `05`'s gate. Already paid goes to the confirmation; only a request that
 * does not exist is a 404 (#387) — every other refusal is a screen the page draws.
 */
export async function gateCheckout(route: RouteParams): Promise<string> {
  await requireRole('customer');
  const requestId = await parseRequestId(route);

  if ((await readBookingForRequest(requestId)) !== null) {
    redirect(`/bookings/${requestId}/confirmed`);
  }

  if ((await openCheckoutOnce(requestId)).state === 'not-found') {
    notFound();
  }

  return requestId;
}
