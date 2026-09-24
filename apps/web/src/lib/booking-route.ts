import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { uuidSchema } from '@vendor-marketplace/shared';
import { requireRole } from './current-user';
import { getBookingForRequest, getOwnBookingRequest } from './customer-data';

/**
 * The status decisions of `/bookings/[requestId]` and its two children, made
 * where they can still be a status (VEN-715).
 *
 * Each route has a `loading.tsx`, which is a Suspense boundary: everything
 * inside it streams after the 200 shell has flushed, so a `notFound()`,
 * `redirect()` or session gate in the page would go out as a soft 404 or a meta
 * refresh under HTTP 200. A layout renders above that boundary, so the layouts
 * call the `gate…` functions below and answer 404 / 307 for real.
 *
 * **The page calls the same gate, and must.** Next renders a layout and its page
 * at the same time, so a page that assumed its layout had finished would read
 * (and, at checkout, open a payment) for a visitor the layout is refusing, and
 * fail with a plain error the server reports. Each gate is `cache()`d per
 * request on the raw id, so the page awaits the layout's own result — or its
 * own refusal, which Next does not report — before it reads anything else.
 *
 * **A gate only reads.** A layout is prefetched with its link once the route has
 * a loader, so nothing that writes (opening checkout mints a payment intent)
 * may run in one.
 */
export const readBookingRequest = cache(getOwnBookingRequest);
export const readBookingForRequest = cache(getBookingForRequest);

interface RouteParams {
  params: Promise<{ requestId: string }>;
}

/**
 * The id, or a 404. Parsed before it reaches a query: the URL is pasteable,
 * and an id the API cannot parse is an identifier that cannot exist.
 */
function parseRequestId(raw: string): string {
  const parsed = uuidSchema.safeParse(raw);

  if (!parsed.success) {
    notFound();
  }

  return parsed.data;
}

/**
 * The customer gate, then the request itself. Missing and not-yours arrive
 * identically — the API answers a stranger with a 404 — so both are `notFound()`.
 */
const gateRequestFor = cache(async (raw: string) => {
  await requireRole('customer');
  const requestId = parseRequestId(raw);
  const request = await readBookingRequest(requestId);

  if (request === null) {
    notFound();
  }

  return { requestId, request };
});

/** Frame `06`'s gate: a request that is not paid yet goes back to checkout. */
const gateConfirmedFor = cache(async (raw: string) => {
  const { requestId, request } = await gateRequestFor(raw);
  const booking = await readBookingForRequest(requestId);

  if (booking === null) {
    redirect(`/bookings/${requestId}/checkout`);
  }

  return { requestId, request, booking };
});

/**
 * Frame `05`'s gate. Already paid goes to the confirmation; only a request that
 * does not exist is a 404 (#387) — every other refusal is a screen the page
 * draws once it has opened checkout.
 */
const gateCheckoutFor = cache(async (raw: string) => {
  await requireRole('customer');
  const requestId = parseRequestId(raw);

  if ((await readBookingForRequest(requestId)) !== null) {
    redirect(`/bookings/${requestId}/confirmed`);
  }

  if ((await readBookingRequest(requestId)) === null) {
    notFound();
  }

  return requestId;
});

export async function gateBookingRequest({ params }: RouteParams) {
  return gateRequestFor((await params).requestId);
}

export async function gateConfirmedBooking({ params }: RouteParams) {
  return gateConfirmedFor((await params).requestId);
}

export async function gateCheckout({ params }: RouteParams): Promise<string> {
  return gateCheckoutFor((await params).requestId);
}
