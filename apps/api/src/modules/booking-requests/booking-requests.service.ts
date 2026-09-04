import {
  BOOKING_REQUEST_EXPIRY_DAYS,
  BOOKING_REQUEST_TRANSITIONS,
  ERROR_CODES,
  EXPIRABLE_BOOKING_REQUEST_STATUSES,
  addDays,
  disclosesCustomerContact,
  isUniversallyPastDate,
  replyDeadline,
  toDateString,
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
  NotificationRow,
  ServicePackageRow,
  VendorProfileRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';
import {
  sendNotificationEmail,
  type NotificationEmailDeps,
} from '../notifications/notification-email.js';
import type { EventHub } from '../../lib/event-stream.js';
import { insertNotification } from '../messaging/messaging.dao.js';
import { notificationHref } from '../messaging/messaging.service.js';
import { AppError, conflict, forbidden, notFound, validationFailed } from '../../lib/errors.js';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import {
  applyTransition,
  ensureConversation,
  findActivePackage,
  findAvailabilityOn,
  findBookings,
  findLiveRequest,
  findPackagesByIds,
  findRequestById,
  findRequests,
  findVendorById,
  findVendorByUserId,
  findVendorUserId,
  findCustomerNames,
  findVendorsByIds,
  insertRequest,
  setHeldDate,
  statusesOnDate,
  hasRivalAcceptanceOn,
  lockHeldDate,
} from './booking-requests.dao.js';
import type { CustomerIdentityRow, VendorSummaryRow } from './booking-requests.dao.js';

/** The four things either party can do to a live request. */
export type RequestAction = 'quote' | 'accept' | 'decline' | 'cancel';

function invalidTransition(from: BookingRequestStatus, to: BookingRequestStatus): AppError {
  return new AppError(
    409,
    ERROR_CODES.INVALID_STATE_TRANSITION,
    `A ${from} request cannot become ${to}`,
  );
}

const NOTIFICATION_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * "December 19", not `2026-12-19`.
 *
 * A notification body is read by a person, and an ISO date in it is a stored
 * value leaking into copy — the same class of defect as rendering a row id.
 */
function readableDate(date: string): string {
  return NOTIFICATION_DATE.format(new Date(`${date}T00:00:00Z`));
}

/**
 * The last calendar day that is **wholly** before the deadline.
 *
 * A bare date in a notification body is read as a local day, and the deadline
 * is an instant. Naming the day the deadline falls in over-promises by the
 * whole of it: an uncapped window ends at the creation time-of-day, so a
 * request sent at 01:00 UTC on a Saturday — Friday evening in Austin — expires
 * at 01:00 UTC the next Saturday, and a vendor who replies at any hour of
 * *their* Saturday is already too late. Formatting `expiresAt − 1ms` names the
 * right UTC day and still hands them a day that is mostly gone.
 *
 * So the deadline is floored to its own UTC midnight first: the day named is
 * one the vendor has in full, in every timezone at or east of UTC, and most of
 * it west. A capped window is unaffected — it already ends at midnight, so the
 * floor is the deadline itself and the answer is the day before, exactly as
 * before. It can never name a day earlier than creation: the tightest window
 * the product writes still spans the creation instant's own midnight.
 *
 * The residual is inherent to a bare day label: "Reply by September 5" for a
 * deadline of September 6 00:00 UTC is still over by seven hours in Austin.
 * The vendor's queue renders the live countdown, which is the surface that can
 * be exact; this one is written once and read days later, so it trades
 * precision for a statement that does not go stale.
 *
 * Falls back to the deadline the product grants when the row carries none, so
 * the copy never has to say "no deadline".
 */
function lastReplyDay(expiresAt: Date | null, now: Date): string {
  const deadline = expiresAt ?? addDays(now, BOOKING_REQUEST_EXPIRY_DAYS);

  return toDateString(new Date(new Date(deadline).setUTCHours(0, 0, 0, 0) - 1));
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

function toVendorSummary(vendor: VendorSummaryRow): BookingRequestDetail['vendor'] {
  return {
    id: vendor.id,
    slug: vendor.slug,
    businessName: vendor.businessName,
    city: vendor.city,
    state: vendor.state,
    avatarUrl: vendor.profileImageUrl,
    categoryName: vendor.categoryName,
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

/** The empty identity, for a customer row that has since been deleted. */
const NO_CUSTOMER: CustomerIdentityRow = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: null,
};

function toDetail(
  row: BookingRequestRow,
  vendor: VendorSummaryRow,
  servicePackage: ServicePackageRow | null,
  customer: CustomerIdentityRow,
): BookingRequestDetail {
  /*
   * The one place the privacy line is drawn, so the three layers that enforce
   * it cannot disagree. Before acceptance the vendor is judging whether to take
   * the work, which does not require being able to identify the person; accept
   * is a commitment to turn up, and the contact details come with it.
   */
  const disclosed = disclosesCustomerContact(row.status);

  return {
    ...row,
    eventStartTime: toClockTime(row.eventStartTime),
    vendor: toVendorSummary(vendor),
    customer: {
      firstName: customer.firstName,
      lastInitial: customer.lastName.trim().slice(0, 1).toUpperCase(),
      lastName: disclosed ? customer.lastName : null,
      /*
       * An empty string is what a user row carries before Clerk has supplied a
       * name, and it is not an address — send `null` rather than fail the
       * response schema on a row that is merely incomplete.
       */
      email: disclosed && customer.email !== '' ? customer.email : null,
      phone: disclosed ? customer.phone : null,
    },
    package: servicePackage ? toPackageSummary(servicePackage) : null,
  };
}

/** One customer's identity, or the empty one when the row has gone. */
async function nameOf(db: AppDatabase, customerId: string): Promise<CustomerIdentityRow> {
  const [found] = await findCustomerNames(db, [customerId]);

  return found ?? NO_CUSTOMER;
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
  mail?: NotificationEmailDeps,
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

  /*
   * A lapsed request stops holding the date. Without this the calendar keeps
   * reading `pending` for a request nobody can act on any more, and the vendor
   * loses a Saturday to a customer who went elsewhere a week ago.
   */
  await syncHeldDate(db, expired.vendorId, expired.eventDate);

  /*
   * Once per request, not once per read — and that is `applyTransition`'s
   * guarded UPDATE doing the work, not a check here. A second caller finds the
   * status already moved, gets `null` above, and returns before this line.
   */
  await notifyParty(
    db,
    expired,
    'customer',
    'request_expired',
    {
      title: 'Your request expired',
      /*
       * "for a week" was a literal that #401 made false: the reply window is
       * now capped at the event, so a request sent four days before its date
       * expires in four days, not seven. The duration is dropped rather than
       * recomputed — the customer's next move does not depend on how long it
       * waited, and a second place that states this deadline is a second place
       * for it to drift.
       */
      body: 'It closed without a reply. Send it again, or find another vendor for the date.',
    },
    undefined,
    mail,
  );

  return expired;
}

interface NotificationCopy {
  title: string;
  body: string;
}

/** A stored notification and the person it is addressed to. */
interface Delivery {
  userId: string;
  stored: NotificationRow;
}

/**
 * Writes the notification row, and nothing else.
 *
 * Split from the live push so a caller inside a transaction can record the
 * notification with the rest of its writes and push only once those have
 * committed — a bell that rings for a row the transaction then rolls back is
 * worse than a bell that rings a moment late.
 */
async function recordNotification(
  db: AppDatabase,
  row: BookingRequestRow,
  party: 'customer' | 'vendor',
  type: NotificationType,
  copy: NotificationCopy,
): Promise<Delivery | null> {
  const userId = party === 'customer' ? row.customerId : await findVendorUserId(db, row.vendorId);

  if (!userId) {
    return null;
  }

  const stored = await insertNotification(db, {
    userId,
    type,
    title: copy.title,
    body: copy.body,
    data: { bookingRequestId: row.id, vendorId: row.vendorId },
  });

  return stored ? { userId, stored } : null;
}

/**
 * Pushed live where a stream is open, so the bell moves the moment the row
 * exists. The row is the source of truth either way — a user with no stream
 * open sees it on their next load, which is why this is best-effort.
 */
function publishNotification(hub: EventHub, { userId, stored }: Delivery): void {
  hub.publish(userId, {
    type: 'new_notification',
    notification: {
      id: stored.id,
      type: stored.type,
      title: stored.title,
      body: stored.body,
      href: notificationHref(stored),
      readAt: stored.readAt,
      createdAt: stored.createdAt,
    },
  });
}

/**
 * Rings the bell and sends the email, in that order, after the row exists.
 *
 * Both are best-effort and neither may fail the operation: the row is the
 * source of truth, a user with no stream open sees it on their next load, and
 * `sendNotificationEmail` swallows its own failures. Doing both here rather
 * than at each call site is what stops an event notifying in-app and not by
 * email by accident — the drift the ticket exists to prevent.
 */
async function deliverNotification(
  delivery: Delivery,
  party: 'customer' | 'vendor',
  hub?: EventHub,
  mail?: NotificationEmailDeps,
): Promise<void> {
  if (hub) {
    publishNotification(hub, delivery);
  }

  if (mail) {
    await sendNotificationEmail(mail, delivery.stored, party);
  }
}

/** Addresses the notification at a person, given which side of the request they are. */
async function notifyParty(
  db: AppDatabase,
  row: BookingRequestRow,
  party: 'customer' | 'vendor',
  type: NotificationType,
  copy: NotificationCopy,
  hub?: EventHub,
  mail?: NotificationEmailDeps,
): Promise<void> {
  const delivery = await recordNotification(db, row, party, type, copy);

  if (delivery) {
    await deliverNotification(delivery, party, hub, mail);
  }
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

/**
 * A created request, or the live one an identical repeat submission matched.
 * The route needs to tell them apart: 201 says a request was made, 200 says
 * this is the request you already made.
 */
export interface BookingRequestOutcome {
  readonly request: BookingRequestDetail;
  readonly created: boolean;
}

export async function createBookingRequest(
  db: AppDatabase,
  hub: EventHub,
  user: AuthenticatedUser,
  input: CreateBookingRequestInput,
  now: Date = new Date(),
  mail?: NotificationEmailDeps,
): Promise<BookingRequestOutcome> {
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
  /*
   * This is also why creation writes nothing to the calendar: a `booked` date
   * is refused here, so by the time a request exists there is no accepted
   * request on the date and nothing for a recompute to find.
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
    expiresAt: replyDeadline(now, input.eventDate),
  };

  /*
   * All three writes or none of them.
   *
   * Without the transaction, a request row that committed before a later
   * write failed would be found by every retry — which then takes the
   * dedupe branch below and deliberately skips the side effects, so the
   * vendor is never told and the thread is never opened, permanently. The
   * retry has to be able to re-create the row, and that means the row must
   * not survive a half-finished attempt.
   */
  const created = await db.transaction(async (tx) => {
    const row = await insertRequest(tx, values);

    if (!row) {
      return null;
    }

    await ensureConversation(tx, {
      customerId: row.customerId,
      vendorId: row.vendorId,
      bookingRequestId: row.id,
    });

    /*
     * The row's own deadline, as a date rather than a countdown.
     *
     * #401 capped the reply window at the event, so the week
     * `bookingRequestWindowPhrase` promises is no longer true of every row: a
     * request for a date three days out gives the vendor less than that.
     * Telling them otherwise recreates exactly the disagreement
     * `one-deadline-one-fee.test.ts` exists to prevent — in a shape that guard
     * cannot see, since it bans hard-coded literals and not a helper that has
     * become conditionally wrong. That helper's own contract already says as
     * much: it is the promise made *before* a row exists, and anything written
     * after one does must read the stored `expiresAt`.
     *
     * A **date**, and deliberately not `expiryCountdown`. This body is stored
     * and then rendered verbatim by the bell and the email for as long as the
     * notification lives, so a relative phrase is only true at write time: a
     * row saying "expires in 5d" sits in the vendor's bell four days later
     * beside a queue row that reads "expires today", which is the same two
     * voices displaced in time rather than removed.
     */
    const delivery = await recordNotification(tx, row, 'vendor', 'new_request', {
      title: 'New booking request',
      body: `A customer asked about ${readableDate(row.eventDate)}. Reply by ${readableDate(lastReplyDay(row.expiresAt, now))}.`,
    });

    return { row, delivery };
  });

  if (!created) {
    /*
     * A repeat submission. Return the request that already exists and none of
     * the side effects: the vendor has been told about it once, and telling
     * them again is the visible half of the defect. `values` is the lookup
     * key as well as the insert, so the two cannot drift apart.
     */
    const existing = await findLiveRequest(db, values);

    if (!existing) {
      throw conflict('That request could not be sent. Try again.');
    }

    return {
      request: toDetail(existing, vendor, servicePackage, await nameOf(db, existing.customerId)),
      created: false,
    };
  }

  /*
   * After the commit, so neither the bell nor the inbox reports a row the
   * transaction then rolled back. This is the seam the split between
   * `recordNotification` and the push was built for; email joins it rather
   * than opening a second one.
   */
  if (created.delivery) {
    await deliverNotification(created.delivery, 'vendor', hub, mail);
  }

  return {
    request: toDetail(
      created.row,
      vendor,
      servicePackage,
      await nameOf(db, created.row.customerId),
    ),
    created: true,
  };
}

export async function getBookingRequest(
  db: AppDatabase,
  user: AuthenticatedUser,
  requestId: string,
  now: Date = new Date(),
  mail?: NotificationEmailDeps,
): Promise<BookingRequestDetail> {
  const row = await findRequestById(db, requestId);

  if (!row) {
    throw notFound('That request does not exist');
  }

  await requireParticipant(db, user, row);

  const current = await ageIfExpired(db, row, now, mail);
  const vendor = await findVendorById(db, current.vendorId);

  if (!vendor) {
    throw notFound('That request does not exist');
  }

  const servicePackage = current.packageId
    ? ((await findPackagesByIds(db, [current.packageId]))[0] ?? null)
    : null;

  return toDetail(current, vendor, servicePackage, await nameOf(db, current.customerId));
}

export async function listBookingRequests(
  db: AppDatabase,
  user: AuthenticatedUser,
  query: { status?: BookingRequestStatus },
  now: Date = new Date(),
  mail?: NotificationEmailDeps,
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
  const aged = await Promise.all(rows.map((row) => ageIfExpired(db, row, now, mail)));
  const visible = query.status ? aged.filter((row) => row.status === query.status) : aged;

  if (visible.length === 0) {
    return [];
  }

  const vendors = await findVendorsByIds(db, [...new Set(visible.map((row) => row.vendorId))]);
  const packages = await findPackagesByIds(db, [
    ...new Set(visible.map((row) => row.packageId).filter((id) => id !== null)),
  ]);

  const names = await findCustomerNames(db, [...new Set(visible.map((row) => row.customerId))]);

  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const packageById = new Map(packages.map((row) => [row.id, row]));
  const nameById = new Map(names.map((name) => [name.id, name]));

  return visible.flatMap((row) => {
    const vendor = vendorById.get(row.vendorId);
    if (!vendor) {
      return [];
    }

    return [
      toDetail(
        row,
        vendor,
        row.packageId ? (packageById.get(row.packageId) ?? null) : null,
        nameById.get(row.customerId) ?? NO_CUSTOMER,
      ),
    ];
  });
}

interface TransitionOptions {
  quote?: QuoteBookingRequestInput;
  now?: Date;
  /** Present when the caller can reach open streams; absent in a plain read. */
  hub?: EventHub;
  /** Present when the caller can send email; absent in a plain read. */
  mail?: NotificationEmailDeps;
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
  const row = await ageIfExpired(db, existing, now, options.mail);

  const vendor = await findVendorById(db, row.vendorId);
  if (!vendor) {
    throw notFound('That request does not exist');
  }

  const target = TARGET_STATUS[action];
  if (!BOOKING_REQUEST_TRANSITIONS[row.status].includes(target)) {
    throw invalidTransition(row.status, target);
  }

  const patch = await prepareTransition({ db, row, vendor, action, party, options });

  /*
   * The write and the calendar it implies commit together, and an accept takes
   * the date's row first so two of them cannot both win (#399).
   *
   * Before this, the two statements ran outside a transaction: a failure
   * between them left an accepted request on a date nothing held, and two
   * accepts for one date each read a free calendar, each wrote `accepted`, and
   * each became payable. The lock is on the availability row rather than the
   * requests, because that is the thing there is exactly one of per date.
   */
  const updated = await db.transaction(async (tx) => {
    if (target === 'accepted') {
      await lockHeldDate(tx, row.vendorId, row.eventDate);

      if (await hasRivalAcceptanceOn(tx, row.vendorId, row.eventDate, row.id)) {
        throw conflict('That date was booked while this request was open');
      }
    }

    const written = await applyTransition(tx, row.id, row.status, { ...patch, status: target });

    if (!written) {
      // The status moved under us between the read and the write.
      throw invalidTransition(row.status, target);
    }

    await syncHeldDate(tx, written.vendorId, written.eventDate);

    return written;
  });

  await announce(
    db,
    updated,
    action,
    row.status,
    vendor.businessName,
    party,
    options.hub,
    options.mail,
  );

  const servicePackage = updated.packageId
    ? ((await findPackagesByIds(db, [updated.packageId]))[0] ?? null)
    : null;

  return toDetail(updated, vendor, servicePackage, await nameOf(db, updated.customerId));
}

/**
 * Recomputes the vendor's calendar cell for one date from the requests that
 * actually exist on it.
 *
 * Derived rather than patched, because the cell has to survive edges a
 * per-action write cannot: two live requests on one date where the vendor
 * declines only one, an accept landing on a date a rival request already held,
 * and a request ageing out on read. Recomputing is idempotent, so calling it
 * after every write costs one indexed read and can never leave the stored
 * calendar disagreeing with the queue.
 *
 * `#212` fixed the mapping: accepted is **`booked`**, because acceptance is the
 * commitment — payment turns it into a `bookings` row in #10, but the vendor
 * has already promised to turn up. Before this, accept wrote `pending`, so the
 * cell read one state below the truth and the `Booked` counter stayed at zero.
 *
 * A *live* request deliberately writes **nothing**. Search excludes any vendor
 * whose row for the date is not `available`, so persisting `pending` here would
 * take a vendor out of the market for a week on a request they have not
 * answered and never agreed to. The vendor's own calendar still shows those
 * dates as `Pending request` — `listOwnAvailability` overlays them at read
 * time, which is the one place that view is wanted.
 */
async function syncHeldDate(db: AppDatabase, vendorId: string, date: string): Promise<void> {
  const statuses = await statusesOnDate(db, vendorId, date);

  await setHeldDate(db, vendorId, date, statuses.includes('accepted') ? 'booked' : null);
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

  /*
   * **Who may decline depends on what is on the table.**
   *
   * From `pending` there is no offer yet, so declining means "I will not take
   * this booking" — the vendor's answer to make. A customer with nothing in
   * front of them is not declining anything; withdrawing is `cancel`, and that
   * one is theirs alone.
   *
   * From `quoted` there is a price, and either party may end it: the vendor
   * withdrawing the offer, or the customer turning it down. Frame `06` draws
   * the customer's half — `Decline` sits beside `Accept` on their quote screen
   * — and #309 found it answering 403, because this branch read the actor
   * without reading the status.
   */
  if (action === 'decline') {
    if (party === 'customer' && row.status !== 'quoted') {
      throw forbidden('You can only decline a request once the vendor has sent a quote');
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
   * An accept has to produce something payable, and two shapes did not (#401).
   *
   * **No price.** A custom request carries none until it is quoted, and
   * accepting one straight from `pending` wrote a terminal `accepted` row that
   * checkout could never open — it 404s on a request with no locked price, and
   * the row cannot go back to `pending` to be quoted. The vendor's own path
   * out of a custom request is `quote`, which this leaves untouched.
   *
   * **A date that has already passed.** The request's seven-day reply window
   * outlives short-notice events, so a request for tomorrow is still
   * answerable a week later. Accepting one produced a booking for a date in
   * the past whose checkout renders the 500 page — the state the parity pass
   * on frame `05` ran into, with the only payable request an automated pass
   * could reach.
   *
   * `isUniversallyPastDate` rather than the server's own day: a date is only
   * refused once it has passed everywhere on earth, so nobody is stopped from
   * accepting a booking that is still today where they are.
   */
  if (row.finalPriceCents === null && row.quotedPriceCents === null) {
    throw validationFailed(
      party === 'vendor'
        ? 'Send a quote before accepting — there is no price on this request yet'
        : 'That request has no price yet',
    );
  }

  if (isUniversallyPastDate(row.eventDate, options.now ?? new Date())) {
    throw conflict(
      party === 'vendor'
        ? 'That event date has passed, so the request can no longer be accepted'
        : 'That date has passed, so this quote can no longer be accepted',
    );
  }

  /*
   * Accepting a quote is the second and last time a price is written. A
   * package request already locked its price at creation, so this leaves it
   * exactly as it was.
   *
   * `acceptedAt` is stamped here rather than read off `updatedAt` later:
   * checkout opens on "…accepted your request on May 2", and `updatedAt` moves
   * again the moment a payment intent is recorded against the request.
   */
  const acceptance = { acceptedAt: options.now ?? new Date() };

  return row.finalPriceCents === null && row.quotedPriceCents !== null
    ? { ...acceptance, finalPriceCents: row.quotedPriceCents }
    : acceptance;
}

/** Tells the other party what just happened to the request they are in. */
async function announce(
  db: AppDatabase,
  row: BookingRequestRow,
  action: RequestAction,
  from: BookingRequestStatus,
  businessName: string,
  /*
   * Who acted. `from` alone cannot answer it: both parties may decline a
   * `quoted` request, and the notification is addressed to the other one.
   */
  party: 'customer' | 'vendor',
  /*
   * **Required, not optional — and that is the fix, not the style.**
   *
   * Both were optional, and `transitionRequest` then called this without
   * `mail` at all. TypeScript was silent, every test stayed green, and four of
   * the thirteen events in the ticket's own table quietly stopped emailing:
   * a quote, an acceptance, a decline and a cancellation each wrote their
   * in-app row and reached no inbox. That is precisely the "notifies in-app and
   * not by email by accident" the design is supposed to make impossible, and an
   * optional parameter is how it got in. Callers now pass `undefined`
   * explicitly or the compiler stops them.
   */
  hub: EventHub | undefined,
  mail: NotificationEmailDeps | undefined,
): Promise<void> {
  switch (action) {
    case 'quote':
      await notifyParty(
        db,
        row,
        'customer',
        'request_quoted',
        {
          title: `${businessName} sent a quote`,
          body: 'Open the request to see the price and accept it.',
        },
        hub,
        mail,
      );
      return;
    case 'accept':
      /*
       * Whoever did not accept is the one who needs telling: the vendor
       * answers a `pending` request, the customer accepts a `quoted` one.
       */
      await notifyParty(
        db,
        row,
        from === 'pending' ? 'customer' : 'vendor',
        'request_accepted',
        {
          title: 'Request accepted',
          body: `${readableDate(row.eventDate)} is held. Payment confirms the booking.`,
        },
        hub,
        mail,
      );
      return;
    case 'decline':
      /*
       * Whoever did not decline is the one who needs telling — the same rule
       * as `accept` above, and for the same reason. Decline used to be the
       * vendor's alone, so this addressed the customer unconditionally; once
       * the customer could decline a quote, that sent them a notification
       * about their own decision, attributed to the vendor ("Sunlit Studio
       * declined"), and told the vendor nothing at all. `request_declined` is
       * the only signal either party gets.
       */
      await (from === 'quoted' && party === 'customer'
        ? notifyParty(
            db,
            row,
            'vendor',
            'request_declined',
            {
              title: 'Quote declined',
              body: `The customer turned down your quote for ${readableDate(row.eventDate)}.`,
            },
            hub,
            mail,
          )
        : notifyParty(
            db,
            row,
            'customer',
            'request_declined',
            {
              title: `${businessName} declined`,
              body: 'The date is free again — try another vendor for it.',
            },
            hub,
            mail,
          ));
      return;
    case 'cancel':
      await notifyParty(
        db,
        row,
        'vendor',
        'request_cancelled',
        {
          title: 'A request was withdrawn',
          body: `The customer cancelled their request for ${readableDate(row.eventDate)}.`,
        },
        hub,
        mail,
      );
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
