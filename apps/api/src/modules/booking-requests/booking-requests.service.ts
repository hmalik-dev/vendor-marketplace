import {
  BOOKING_REQUEST_EXPIRY_DAYS,
  BOOKING_REQUEST_TRANSITIONS,
  ERROR_CODES,
  EXPIRABLE_BOOKING_REQUEST_STATUSES,
  addDays,
  isUniversallyPastDate,
  type BookingRequestDetail,
  type BookingRequestStatus,
  type BookingWithContext,
  type CreateBookingRequestInput,
  type NotificationType,
  type QuoteBookingRequestInput,
} from '@vendor-marketplace/shared';
import type {
  BookingRequestRow,
  NewBookingRequestRow,
  ServicePackageRow,
  VendorProfileRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import { AppError, conflict, forbidden, notFound, validationFailed } from '../../lib/errors.js';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import {
  applyTransition,
  ensureConversation,
  findActivePackage,
  findAvailabilityOn,
  findBookings,
  findPackagesByIds,
  findRequestById,
  findRequests,
  findVendorById,
  findVendorByUserId,
  findVendorUserId,
  findVendorsByIds,
  holdDate,
  insertNotification,
  insertRequest,
} from './booking-requests.dao.js';

/** The four things either party can do to a live request. */
export type RequestAction = 'quote' | 'accept' | 'decline' | 'cancel';

function invalidTransition(from: BookingRequestStatus, to: BookingRequestStatus): AppError {
  return new AppError(
    409,
    ERROR_CODES.INVALID_STATE_TRANSITION,
    `A ${from} request cannot become ${to}`,
  );
}

/** Postgres NUMERIC arrives as a string; the wire contract is a number. */
function parseRating(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDurationHours(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Postgres `time` comes back as `HH:MM:SS`; the form, the frame and the wire
 * schema all speak `HH:MM`. Trimming here keeps the seconds out of the
 * contract rather than teaching every reader to ignore them.
 */
function toClockTime(value: string | null): string | null {
  return value === null ? null : value.slice(0, 5);
}

function toVendorSummary(vendor: VendorProfileRow): BookingRequestDetail['vendor'] {
  return {
    id: vendor.id,
    slug: vendor.slug,
    businessName: vendor.businessName,
    city: vendor.city,
    state: vendor.state,
    avatarUrl: vendor.profileImageUrl,
    avgRating: parseRating(vendor.avgRating),
    reviewCount: vendor.reviewCount,
  };
}

function toPackageSummary(row: ServicePackageRow): NonNullable<BookingRequestDetail['package']> {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.priceCents,
    priceType: row.priceType,
    durationHours: parseDurationHours(row.durationHours),
    inclusions: row.inclusions ?? [],
  };
}

function toDetail(
  row: BookingRequestRow,
  vendor: VendorProfileRow,
  servicePackage: ServicePackageRow | null,
): BookingRequestDetail {
  return {
    ...row,
    eventStartTime: toClockTime(row.eventStartTime),
    vendor: toVendorSummary(vendor),
    package: servicePackage ? toPackageSummary(servicePackage) : null,
  };
}

/**
 * Expiry is lazy: nothing sweeps the table on a timer, so a request that has
 * run past its window is aged on the next read of it. The write is guarded on
 * the status it was read at, so a vendor accepting in the same second either
 * wins or is told the request expired — never both.
 */
async function ageIfExpired(
  db: AppDatabase,
  row: BookingRequestRow,
  now: Date,
): Promise<BookingRequestRow> {
  const expirable = (EXPIRABLE_BOOKING_REQUEST_STATUSES as readonly string[]).includes(row.status);

  if (!expirable || row.expiresAt === null || row.expiresAt.getTime() > now.getTime()) {
    return row;
  }

  const expired = await applyTransition(db, row.id, row.status, { status: 'expired' });
  if (!expired) {
    // Something else moved it first; that decision stands.
    return (await findRequestById(db, row.id)) ?? row;
  }

  await notifyParty(db, expired, 'customer', 'request_expired', {
    title: 'Your request expired',
    body: 'It went unanswered for a week. Send it again, or find another vendor for the date.',
  });

  return expired;
}

interface NotificationCopy {
  title: string;
  body: string;
}

/** Addresses the notification at a person, given which side of the request they are. */
async function notifyParty(
  db: AppDatabase,
  row: BookingRequestRow,
  party: 'customer' | 'vendor',
  type: NotificationType,
  copy: NotificationCopy,
): Promise<void> {
  const userId = party === 'customer' ? row.customerId : await findVendorUserId(db, row.vendorId);

  if (!userId) {
    return;
  }

  await insertNotification(db, {
    userId,
    type,
    title: copy.title,
    body: copy.body,
    data: { bookingRequestId: row.id, vendorId: row.vendorId },
  });
}

/** The caller's vendor profile id, when they hold the vendor role. */
async function actorVendorId(db: AppDatabase, user: AuthenticatedUser): Promise<string | null> {
  if (user.role !== 'vendor') {
    return null;
  }

  const vendor = await findVendorByUserId(db, user.id);
  return vendor?.id ?? null;
}

/** Fails unless the caller is one of the two people the request belongs to. */
async function requireParticipant(
  db: AppDatabase,
  user: AuthenticatedUser,
  row: BookingRequestRow,
): Promise<'customer' | 'vendor'> {
  if (row.customerId === user.id) {
    return 'customer';
  }

  if ((await actorVendorId(db, user)) === row.vendorId) {
    return 'vendor';
  }

  // Deliberately 404 rather than 403: a stranger probing ids learns nothing
  // about which of them exist.
  throw notFound('That request does not exist');
}

export async function createBookingRequest(
  db: AppDatabase,
  user: AuthenticatedUser,
  input: CreateBookingRequestInput,
  now: Date = new Date(),
): Promise<BookingRequestDetail> {
  const vendor = await findVendorById(db, input.vendorId);

  if (!vendor || vendor.isDeleted || !vendor.isPublished) {
    throw notFound('That vendor is not taking requests');
  }

  if (vendor.userId === user.id) {
    throw forbidden('You cannot request a booking from your own listing');
  }

  if (isUniversallyPastDate(input.eventDate, now)) {
    throw validationFailed('Choose a date in the future');
  }

  /*
   * `booked` is a hard stop — the date is gone, and a request for it can only
   * end in a decline. `blocked` is not: frame `22` explicitly lets the customer
   * send anyway, in gold rather than red, because a vendor who has held a day
   * for themselves may still say yes to the right event.
   */
  const calendar = await findAvailabilityOn(db, vendor.id, input.eventDate);
  if (calendar?.status === 'booked') {
    throw conflict(`${vendor.businessName} is already booked on that date`);
  }

  let servicePackage: ServicePackageRow | null = null;
  if (input.packageId !== undefined) {
    servicePackage = await findActivePackage(db, vendor.id, input.packageId);

    if (!servicePackage) {
      throw notFound('That package is no longer offered');
    }
  }

  const values: NewBookingRequestRow = {
    customerId: user.id,
    vendorId: vendor.id,
    packageId: servicePackage?.id ?? null,
    eventDate: input.eventDate,
    eventStartTime: input.eventStartTime ?? null,
    eventType: input.eventType ?? null,
    eventLocation: input.eventLocation ?? null,
    guestCount: input.guestCount ?? null,
    customDetails: input.customDetails ?? null,
    status: 'pending',
    // Locked at the price on offer today; a later package edit cannot move it.
    finalPriceCents: servicePackage?.priceCents ?? null,
    expiresAt: addDays(now, BOOKING_REQUEST_EXPIRY_DAYS),
  };

  const row = await insertRequest(db, values);

  await ensureConversation(db, {
    customerId: row.customerId,
    vendorId: row.vendorId,
    bookingRequestId: row.id,
  });

  await notifyParty(db, row, 'vendor', 'new_request', {
    title: 'New booking request',
    body: `A customer asked about ${row.eventDate}. You have a week to reply.`,
  });

  return toDetail(row, vendor, servicePackage);
}

export async function getBookingRequest(
  db: AppDatabase,
  user: AuthenticatedUser,
  requestId: string,
  now: Date = new Date(),
): Promise<BookingRequestDetail> {
  const row = await findRequestById(db, requestId);

  if (!row) {
    throw notFound('That request does not exist');
  }

  await requireParticipant(db, user, row);

  const current = await ageIfExpired(db, row, now);
  const vendor = await findVendorById(db, current.vendorId);

  if (!vendor) {
    throw notFound('That request does not exist');
  }

  const servicePackage = current.packageId
    ? ((await findPackagesByIds(db, [current.packageId]))[0] ?? null)
    : null;

  return toDetail(current, vendor, servicePackage);
}

export async function listBookingRequests(
  db: AppDatabase,
  user: AuthenticatedUser,
  query: { status?: BookingRequestStatus },
  now: Date = new Date(),
): Promise<BookingRequestDetail[]> {
  const vendorId = await actorVendorId(db, user);

  /*
   * A vendor with no profile yet has no queue, and a customer's queue is their
   * own — neither can name whose requests to read, so scoping is derived from
   * the session rather than accepted from the query string.
   */
  const filter = vendorId ? { vendorId } : { customerId: user.id };
  if (user.role === 'vendor' && !vendorId) {
    return [];
  }

  const rows = await findRequests(db, filter);

  /*
   * Expiry is applied before the status filter, so asking for `expired`
   * returns the request that aged out on this very read rather than missing it
   * until someone happens to open it.
   */
  const aged = await Promise.all(rows.map((row) => ageIfExpired(db, row, now)));
  const visible = query.status ? aged.filter((row) => row.status === query.status) : aged;

  if (visible.length === 0) {
    return [];
  }

  const vendors = await findVendorsByIds(db, [...new Set(visible.map((row) => row.vendorId))]);
  const packages = await findPackagesByIds(db, [
    ...new Set(visible.map((row) => row.packageId).filter((id) => id !== null)),
  ]);

  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const packageById = new Map(packages.map((row) => [row.id, row]));

  return visible.flatMap((row) => {
    const vendor = vendorById.get(row.vendorId);
    if (!vendor) {
      return [];
    }

    return [toDetail(row, vendor, row.packageId ? (packageById.get(row.packageId) ?? null) : null)];
  });
}

interface TransitionOptions {
  quote?: QuoteBookingRequestInput;
  now?: Date;
}

/**
 * The state machine. Every legal edge is in `BOOKING_REQUEST_TRANSITIONS`;
 * this adds who may walk it and what else has to be true when they do.
 */
export async function transitionRequest(
  db: AppDatabase,
  requestId: string,
  action: RequestAction,
  user: AuthenticatedUser,
  options: TransitionOptions = {},
): Promise<BookingRequestDetail> {
  const now = options.now ?? new Date();
  const existing = await findRequestById(db, requestId);

  if (!existing) {
    throw notFound('That request does not exist');
  }

  const party = await requireParticipant(db, user, existing);
  const row = await ageIfExpired(db, existing, now);

  const vendor = await findVendorById(db, row.vendorId);
  if (!vendor) {
    throw notFound('That request does not exist');
  }

  const target = TARGET_STATUS[action];
  if (!BOOKING_REQUEST_TRANSITIONS[row.status].includes(target)) {
    throw invalidTransition(row.status, target);
  }

  const patch = await prepareTransition({ db, row, vendor, action, party, options });
  const updated = await applyTransition(db, row.id, row.status, { ...patch, status: target });

  if (!updated) {
    // The status moved under us between the read and the write.
    throw invalidTransition(row.status, target);
  }

  if (action === 'accept') {
    await holdDate(db, updated.vendorId, updated.eventDate);
  }

  await announce(db, updated, action, row.status, vendor.businessName);

  const servicePackage = updated.packageId
    ? ((await findPackagesByIds(db, [updated.packageId]))[0] ?? null)
    : null;

  return toDetail(updated, vendor, servicePackage);
}

const TARGET_STATUS: Record<RequestAction, BookingRequestStatus> = {
  quote: 'quoted',
  accept: 'accepted',
  decline: 'declined',
  cancel: 'cancelled',
};

interface PrepareArgs {
  db: AppDatabase;
  row: BookingRequestRow;
  vendor: VendorProfileRow;
  action: RequestAction;
  party: 'customer' | 'vendor';
  options: TransitionOptions;
}

/** Authorises the actor for this action and returns the columns it writes. */
async function prepareTransition({
  db,
  row,
  vendor,
  action,
  party,
  options,
}: PrepareArgs): Promise<Partial<NewBookingRequestRow>> {
  if (action === 'cancel') {
    if (party !== 'customer') {
      throw forbidden('Only the customer can withdraw a request');
    }
    return {};
  }

  if (action === 'decline') {
    if (party !== 'vendor') {
      throw forbidden('Only the vendor can decline a request');
    }
    return {};
  }

  if (action === 'quote') {
    if (party !== 'vendor') {
      throw forbidden('Only the vendor can send a quote');
    }

    /*
     * A package request already carries a locked price, and the lock is
     * immutable — so there is nothing here to quote. The vendor's route out of
     * a package they no longer want to honour is to decline.
     */
    if (row.finalPriceCents !== null) {
      throw validationFailed('This request is already priced by its package');
    }

    const quote = options.quote;
    if (!quote) {
      throw validationFailed('A quote needs a price');
    }

    return { quotedPriceCents: quote.quotedPriceCents, quoteNote: quote.quoteNote ?? null };
  }

  // accept
  if (row.status === 'pending' && party !== 'vendor') {
    throw forbidden('The vendor answers a new request');
  }
  if (row.status === 'quoted' && party !== 'customer') {
    throw forbidden('The customer accepts the quote');
  }

  if (!vendor.stripeOnboarded) {
    throw new AppError(
      402,
      ERROR_CODES.PAYMENT_REQUIRED,
      party === 'vendor'
        ? 'Finish your payout setup before accepting bookings'
        : `${vendor.businessName} cannot take payment yet`,
    );
  }

  const calendar = await findAvailabilityOn(db, row.vendorId, row.eventDate);
  if (calendar?.status === 'booked') {
    throw conflict('That date was booked while this request was open');
  }

  /*
   * Accepting a quote is the second and last time a price is written. A
   * package request already locked its price at creation, so this leaves it
   * exactly as it was.
   */
  return row.finalPriceCents === null && row.quotedPriceCents !== null
    ? { finalPriceCents: row.quotedPriceCents }
    : {};
}

/** Tells the other party what just happened to the request they are in. */
async function announce(
  db: AppDatabase,
  row: BookingRequestRow,
  action: RequestAction,
  from: BookingRequestStatus,
  businessName: string,
): Promise<void> {
  switch (action) {
    case 'quote':
      await notifyParty(db, row, 'customer', 'request_quoted', {
        title: `${businessName} sent a quote`,
        body: 'Open the request to see the price and accept it.',
      });
      return;
    case 'accept':
      /*
       * Whoever did not accept is the one who needs telling: the vendor
       * answers a `pending` request, the customer accepts a `quoted` one.
       */
      await notifyParty(db, row, from === 'pending' ? 'customer' : 'vendor', 'request_accepted', {
        title: 'Request accepted',
        body: `${row.eventDate} is held. Payment confirms the booking.`,
      });
      return;
    case 'decline':
      await notifyParty(db, row, 'customer', 'request_declined', {
        title: `${businessName} declined`,
        body: 'The date is free again — try another vendor for it.',
      });
      return;
    case 'cancel':
      await notifyParty(db, row, 'vendor', 'request_cancelled', {
        title: 'A request was withdrawn',
        body: `The customer cancelled their request for ${row.eventDate}.`,
      });
  }
}

/**
 * The bookings each party holds, carrying the occasion and the venue the hub
 * renders under the vendor name.
 */
export async function listBookings(
  db: AppDatabase,
  user: AuthenticatedUser,
): Promise<BookingWithContext[]> {
  const vendorId = await actorVendorId(db, user);

  if (user.role === 'vendor' && !vendorId) {
    return [];
  }

  const rows = await findBookings(db, vendorId ? { vendorId } : { customerId: user.id });

  return rows.map(({ booking, eventType }) => ({
    ...booking,
    eventType,
    venue: booking.eventLocation,
  }));
}
