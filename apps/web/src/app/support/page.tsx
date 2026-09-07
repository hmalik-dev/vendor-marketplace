import {
  pageTitle,
  supportErrorContextSchema,
  uuidSchema,
  type SupportErrorContext,
} from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { SupportScreen } from '@/components/support/support-screen';
import { reportWindowFor, type SupportBookingContext } from '@/lib/booking-report';
import { readOwnBookingForSupport } from '@/lib/customer-data';
import { readIdentityForSupport } from '@/lib/current-user';
import {
  SUPPORT_BOOKING_PARAM,
  SUPPORT_ERROR_AT_PARAM,
  SUPPORT_ERROR_DIGEST_PARAM,
  SUPPORT_ERROR_ROUTE_PARAM,
} from '@/lib/support-link';
import type { WireUser } from '@/lib/wire-schemas';

/**
 * The booking a `Report a problem` named, when this visitor is the customer on
 * it and it can still be reported (#425).
 *
 * **Role first, and the role is `customer`.** Acceptance 6 says a vendor cannot
 * reach this for a booking they are the vendor on. The API refuses them too —
 * `findOwnBookingForReport` answers a vendor 404 — but checking here costs
 * nothing and keeps a public page from making an authenticated read on behalf
 * of somebody who cannot use the answer. A vendor, an admin and a signed-out
 * visitor all take an early return and see the ordinary contact form.
 *
 * Outside the window the block is dropped whole, the treatment #421 chose for a
 * half-valid error reference and for the same reason: a screen that rendered a
 * booking it could not report would be offering a control the API is about to
 * refuse.
 */
async function readBookingContext(
  user: WireUser | null,
  raw: string | string[] | undefined,
): Promise<SupportBookingContext | null> {
  if (user?.role !== 'customer') {
    return null;
  }

  const parsed = uuidSchema.safeParse(raw);

  if (!parsed.success) {
    return null;
  }

  const booking = await readOwnBookingForSupport(parsed.data);

  if (!booking || reportWindowFor(booking) !== 'open') {
    return null;
  }

  return {
    id: booking.id,
    eventDate: booking.eventDate,
    totalAmountCents: booking.totalAmountCents,
    venue: booking.eventLocation,
  };
}

export const metadata: Metadata = { title: pageTitle('Contact support') };

/**
 * Frame `29 Contact support` — the destination every `Contact support`
 * affordance in the product leads to.
 *
 * **Public, and deliberately so:** the visitor most likely to need it is the
 * one who cannot sign in. Identity is read anyway, because it is the whole
 * difference between the screen's first two states, and it is read through
 * `readIdentityForSupport` — the one read in the product that redirects
 * nobody. An unreadable record, a suspended account and an unreachable API all
 * cost the reply-to row rather than the page, which matters most here: this is
 * where a visitor comes to report that the rest of it is broken.
 */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const [user, params] = await Promise.all([readIdentityForSupport(), searchParams]);

  /*
   * Parsed before anything renders it — `web-route-boundaries.md`. All three
   * values arrive in a URL anyone can paste into Slack, and the block is shown
   * only when the whole object parses: a half-valid reference reaches the
   * support inbox looking like a server-log entry that does not exist, and a
   * route that failed its shape has no business being quoted back in an email.
   * A failure drops it and the screen renders without it, exactly as a visitor
   * arriving from the footer sees it.
   */
  const parsed = supportErrorContextSchema.safeParse({
    digest: params[SUPPORT_ERROR_DIGEST_PARAM],
    route: params[SUPPORT_ERROR_ROUTE_PARAM],
    occurredAt: params[SUPPORT_ERROR_AT_PARAM],
  });

  const errorContext: SupportErrorContext | null = parsed.success ? parsed.data : null;

  const bookingContext = await readBookingContext(user, params[SUPPORT_BOOKING_PARAM]);

  return (
    <SupportScreen
      accountEmail={user?.email ?? null}
      errorContext={errorContext}
      bookingContext={bookingContext}
    />
  );
}
