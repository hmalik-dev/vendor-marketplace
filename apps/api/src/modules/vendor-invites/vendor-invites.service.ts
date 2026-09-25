import {
  BRAND_NAME,
  EMAIL_RETRY_MAX_ATTEMPTS,
  EMAIL_RETRY_WINDOW_MS,
  ERROR_CODES,
  US_STATE_NAMES,
  VENDOR_SIGN_IN_PATH,
  VENDOR_SIGN_UP_PATH,
  isVendorApplicationComplete,
  type AdminVendorApplicationList,
  type AdminVendorApplicationRow,
  type AdminVendorInviteList,
  type AdminVendorInviteQuery,
  type AdminVendorInviteRow,
  type BulkInviteApplicationsResult,
  type BulkInviteResultItem,
  type MyVendorApplication,
  type UsStateCode,
  type UserRole,
  type VendorApplicationDecision,
  type VendorApplicationInput,
  type VendorApplicationReceipt,
  type VendorSignUpGate,
} from '@vendor-marketplace/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { BackgroundWork } from '../../lib/background.js';
import type { AppDatabase } from '../../lib/database.js';
import type { EmailGateway } from '../../lib/email.js';
import { AppError, conflict, notFound, validationFailed } from '../../lib/errors.js';
import { escapeHtml } from '../../lib/html-escape.js';
import { insertAdminAction } from '../admin/admin.dao.js';
import {
  button,
  emphasis,
  factBox,
  paragraph,
  renderVendorEmailLayout,
  smallParagraph,
} from './vendor-invite-email-layout.js';
import { findActiveCategoryIds } from '../vendors/vendors.dao.js';
import {
  readPlatformSwitches,
  readPlatformSwitchesUncached,
} from '../platform-settings/platform-settings.service.js';
import type { Clock } from '../../plugins/clock.js';
import {
  deleteUnusedInvite,
  claimApplicationConfirmationAttempt,
  countAdminApplications,
  countAdminInvites,
  findAdminApplications,
  findAdminInviteById,
  findAdminInvites,
  findApplicationByEmail,
  findInviteByEmail,
  findInviteById,
  hasLiveAccount,
  insertInviteIfAbsent,
  inviteEmailState,
  inviteKey,
  lockApplication,
  lockInviteByEmail,
  lockInviteById,
  lockRetryableApplication,
  lockRetryableInvite,
  recordApplicationEmailAttempt,
  recordClaimedApplicationEmailOutcome,
  recordInviteEmailAttempt,
  markApplicationInvited,
  markInviteAccepted,
  resolveCategoryName,
  restoreApplicationStatus,
  seedApplication,
  setApplicationStatus,
  upsertApplication,
} from './vendor-invites.dao.js';

/**
 * The vendor gate (VEN-406): supply is chosen, demand is open.
 *
 * While `vendorInviteOnly` is on, the Terms acceptance — the one place an
 * account comes into existence — creates a **vendor** account only for an
 * address the admin has invited. A customer is never asked.
 */

/** What the invite email needs to leave this process. */
export interface VendorInviteMailDeps {
  db: AppDatabase;
  email: EmailGateway;
  background: BackgroundWork;
  log: FastifyBaseLogger;
  /** `canonicalWebOrigin(env)`, which the sign-up link is built on. */
  webOrigin: string;
  now: Clock;
}

const ACCOUNT_EXISTS_MESSAGE =
  'That address already has an account. Use a different email address to apply as a vendor.';

export function vendorNotInvited(): AppError {
  return new AppError(
    403,
    ERROR_CODES.VENDOR_NOT_INVITED,
    "Vendor accounts are invite-only for now. No account was created. You're on the waitlist: tell us about your business and we'll invite you.",
  );
}

/**
 * Refuses a vendor account for an address nobody invited, while the gate is on,
 * and stamps the invite of one that was.
 *
 * Runs **first** in the transaction that creates the account, so a refusal
 * rolls back to no account, no acceptance and no profile, and the invite row is
 * locked until that transaction ends — a concurrent revoke cannot slip between
 * the check and the account. Any role but `vendor` passes untouched.
 */
export async function admitVendor(tx: AppDatabase, role: UserRole, email: string): Promise<void> {
  if (role !== 'vendor') {
    return;
  }

  // Read from the row: a transaction handle is new per call, so the cache could only miss.
  const { vendorInviteOnly } = await readPlatformSwitchesUncached(tx);
  const invite = vendorInviteOnly ? await lockInviteByEmail(tx, email) : null;

  if (vendorInviteOnly && !invite) {
    throw vendorNotInvited();
  }

  await markInviteAccepted(tx, email);
}

/**
 * Writes the waitlist row for a vendor the gate just refused, and rethrows.
 *
 * Call from **outside** the transaction `admitVendor` refused in: that
 * transaction has already rolled back by the time its rejection reaches the
 * caller, so a write inside it would roll back too, and nobody would be on
 * the list the refusal is supposed to put them on. Any other error passes
 * through untouched — this only recognises the vendor gate's own refusal.
 */
export async function seedApplicationOnRefusal(
  db: AppDatabase,
  error: unknown,
  email: string,
  log?: { error: (details: unknown, message: string) => void },
): Promise<never> {
  if (error instanceof AppError && error.code === ERROR_CODES.VENDOR_NOT_INVITED) {
    /*
     * An address with a live account is refused by `hasLiveAccount` wherever
     * it later tries to complete the waitlist, so a row for it would sit on
     * the admin's list unable ever to be invited. The only caller this can
     * reach for is the existing-account acceptance path (a `users` row with
     * `role = 'vendor'` and no acceptance yet, refused because its invite was
     * revoked or never existed) — rare, but cheap to exclude.
     *
     * Best effort otherwise: the refusal itself is the outcome the caller is
     * owed, and a transient failure writing the waitlist row must not turn
     * their 403 `VENDOR_NOT_INVITED` (which the client keys navigation on)
     * into an opaque 500.
     */
    if (!(await hasLiveAccount(db, email))) {
      // The payload is the error alone: the address is personal data and stays out of the log.
      await seedApplication(db, email).catch((err: unknown) => {
        log?.error({ err }, 'waitlist seed failed');
      });
    }
  }

  throw error;
}

/**
 * The role to **preselect** on the acceptance screen: `vendor` for an address
 * with an unused invite, otherwise nothing.
 *
 * It is a suggestion and never a default: the browser hint lives 24 hours and
 * the invite email tells a refused vendor to sign in rather than sign up again,
 * so an invitee arriving later has no hint. The person still confirms the role,
 * and the account is written with what they confirmed (VEN-507).
 */
export async function invitedRoleHint(
  db: AppDatabase,
  email: string,
): Promise<'vendor' | undefined> {
  const invite = await findInviteByEmail(db, email);

  return invite && invite.acceptedAt === null ? 'vendor' : undefined;
}

/**
 * Whether `admitVendor` would actually refuse `email` as a vendor **right
 * now**: the gate is on, nobody has invited the address, and no account
 * already exists for it.
 *
 * This is the one authorization check every door onto the waitlist shares —
 * `readMyVendorApplication`'s seed, `readVendorWaitlistStatus`'s redirect, and
 * the web pages that reach either — so a customer, an invited vendor, or an
 * address with a live account can never be diverted onto it, however they
 * arrive at the URL. It intentionally does not run inside a transaction: it
 * is advisory for routing, and `admitVendor` remains the one place that
 * enforces it with a lock.
 */
export async function wouldRefuseVendor(db: AppDatabase, email: string): Promise<boolean> {
  const { vendorInviteOnly } = await readPlatformSwitches(db);

  if (!vendorInviteOnly) {
    return false;
  }

  const [invited, hasAccount] = await Promise.all([
    invitedRoleHint(db, email),
    hasLiveAccount(db, email),
  ]);

  return !invited && !hasAccount;
}

/**
 * Whether this address is still stuck on the waitlist, read-only — the Terms
 * gate's own use, which must never seed one for an address that was only
 * ever a customer. `readMyVendorApplication` is the seeding read.
 *
 * Gated on {@link wouldRefuseVendor}, not merely on the row's existence: an
 * application does not disappear when it is invited (`markApplicationInvited`
 * only changes its status) or when the gate is later switched off, and a row
 * from either state must not go on diverting its owner away from
 * `/accept-terms` forever.
 */
export async function readVendorWaitlistStatus(
  db: AppDatabase,
  email: string,
): Promise<{ exists: boolean; complete: boolean }> {
  if (!(await wouldRefuseVendor(db, email))) {
    return { exists: false, complete: false };
  }

  const row = await findApplicationByEmail(db, email);

  return row ? { exists: true, complete: row.complete } : { exists: false, complete: false };
}

/** `GET /vendor-applications/gate`. */
export async function readVendorSignUpGate(db: AppDatabase): Promise<VendorSignUpGate> {
  const { vendorInviteOnly } = await readPlatformSwitches(db);

  return { vendorInviteOnly };
}

/**
 * `POST /vendor-applications`: the details screen's submit (VEN-512).
 *
 * Requires a session — a verified vendor address, always, since the gate is
 * the only door onto this route now (`vendor-invites.routes.ts` refuses a
 * signed-out call before this runs). The typed-email, signed-out path this
 * used to serve is gone: a stranger can no longer fill the waitlist with
 * addresses that were never verified.
 */
export async function submitVendorApplication(
  deps: VendorInviteMailDeps,
  body: VendorApplicationInput,
  sessionEmail: string,
): Promise<VendorApplicationReceipt> {
  const input = { ...body, email: sessionEmail };

  // An address with an account can never become a vendor (`users.role` is fixed at creation).
  if (await hasLiveAccount(deps.db, input.email)) {
    throw conflict(ACCOUNT_EXISTS_MESSAGE);
  }

  if ((await findActiveCategoryIds(deps.db, [input.category])).length === 0) {
    throw validationFailed(
      'That category is not available. Reload and choose from the current list.',
      { field: 'category' },
    );
  }

  /*
   * The write and the confirmation's one-time claim, in the same transaction.
   * `upsertApplication` returns no id when its `setWhere` refuses the write
   * (the row exists but is no longer `new` — already invited or declined): no
   * claim is attempted then, because sending "we've saved your details" for a
   * submit that saved nothing would be a false receipt. When it does write,
   * `claimApplicationConfirmationAttempt` is the atomic compare-and-swap that
   * makes "first submit" race-free — two submits for the same address landing
   * at once can each write the row, but only one flips
   * `confirmation_email_attempts` from 0 to 1, the same shape
   * `insertInviteIfAbsent`'s unique index gives the invite email's own claim.
   */
  const { applicationId, claimed } = await deps.db.transaction(async (tx) => {
    // Already invited by address: the application arrives decided, so it cannot be declined past the invite.
    const invited = (await findInviteByEmail(tx, input.email)) !== null;
    const writtenId = await upsertApplication(tx, input, invited ? 'invited' : 'new', true);

    if (writtenId === undefined) {
      return { applicationId: undefined, claimed: false };
    }

    return {
      applicationId: writtenId,
      claimed: await claimApplicationConfirmationAttempt(tx, writtenId, deps.now()),
    };
  });

  if (applicationId !== undefined && claimed) {
    const categoryName = (await resolveCategoryName(deps.db, input.category)) ?? input.category;

    queueApplicationConfirmationEmail(deps, {
      id: applicationId,
      email: input.email,
      businessName: input.businessName,
      categoryName,
      city: input.city,
      state: input.state ?? null,
    });
  }

  return { received: true };
}

/**
 * `GET /vendor-applications/me`: the details screen's read (VEN-512).
 *
 * **Read-only. It never writes a row.** The one and only writer is
 * {@link seedApplicationOnRefusal}, which fires from an *actual* `admitVendor`
 * refusal — so by the time a legitimately refused vendor ever reaches this
 * route, their row already exists, written the moment they were refused
 * rather than on whichever later visit happens to call this. "Nobody is lost
 * by leaving early" therefore holds without this route creating anything: the
 * loss it guards against already happened at the refusal, not at arrival.
 *
 * A seeding version of this used to exist and was removed: any verified
 * session — a customer, an invited vendor, one with a live account, or simply
 * someone who typed the URL — could reach it with no account yet, and writing
 * a row for any of them would divert that address away from `/accept-terms`
 * forever (`readVendorWaitlistStatus` gates the redirect on the same row).
 * Gated on {@link wouldRefuseVendor} here too, so a row from before the gate
 * lifted or before an invite landed is not reported back either.
 */
export async function readMyVendorApplication(
  db: AppDatabase,
  sessionEmail: string,
): Promise<MyVendorApplication> {
  const empty: MyVendorApplication = {
    email: sessionEmail,
    businessName: null,
    category: null,
    city: null,
    state: null,
    message: null,
    complete: false,
  };

  if (!(await wouldRefuseVendor(db, sessionEmail))) {
    return empty;
  }

  return (await findApplicationByEmail(db, sessionEmail)) ?? empty;
}

export async function listVendorApplications(
  db: AppDatabase,
  query: AdminVendorInviteQuery,
): Promise<AdminVendorApplicationList> {
  const [items, counts] = await Promise.all([
    findAdminApplications(db, query.pageSize, (query.page - 1) * query.pageSize),
    countAdminApplications(db),
  ]);

  return {
    items,
    total: counts.total,
    waiting: counts.waiting,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function listVendorInvites(
  db: AppDatabase,
  query: AdminVendorInviteQuery,
): Promise<AdminVendorInviteList> {
  const [items, total] = await Promise.all([
    findAdminInvites(db, query.pageSize, (query.page - 1) * query.pageSize),
    countAdminInvites(db),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

/**
 * The invite email, in one of two variants (VEN-516, frame 38): `hasApplication`
 * is true for an address that already has a waitlist application, which is
 * true for every address that has ever signed up — a login already exists, so
 * the invite tells them to sign in. False is a direct invite the admin sent
 * with no application behind it: nobody, so the invite tells them to sign up.
 * Wording is frame 38's, not restated here so it cannot drift.
 */
export function renderVendorInviteEmail(
  webOrigin: string,
  email: string,
  hasApplication: boolean,
): {
  subject: string;
  text: string;
  html: string;
} {
  const link = `${webOrigin}${hasApplication ? VENDOR_SIGN_IN_PATH : VENDOR_SIGN_UP_PATH}`;
  const intro = `You're invited to join ${BRAND_NAME} as a vendor.`;
  // The sign-up sentence quotes the address; its html variant just bolds the
  // same quoted text, so both are built from the one template below.
  function signUpHow(emailMarkup: string): string {
    return `Sign up with ${emailMarkup} to open your vendor account.`;
  }
  const how = hasApplication
    ? 'Sign in with the email and password you already made to open your vendor account.'
    : signUpHow(email);
  const howHtml = hasApplication ? escapeHtml(how) : signUpHow(emphasis(email));
  const next = 'Then set your prices, add your work and open the dates you want booked.';
  const buttonLabel = hasApplication ? `Sign in to ${BRAND_NAME}` : 'Sign up as a vendor';
  const footer = hasApplication
    ? `You asked to join ${BRAND_NAME} as a vendor. If that wasn't you, ignore this email.`
    : `Your business was put forward to join ${BRAND_NAME}. If you'd rather not, ignore this email.`;

  return {
    subject: `You're invited to join ${BRAND_NAME} as a vendor`,
    text: [intro, '', how, next, '', link, '', footer].join('\n'),
    html: renderVendorEmailLayout({
      headline: 'Your invitation is here',
      bodyHtml: [
        paragraph(`${escapeHtml(intro)} ${howHtml}`, 14),
        paragraph(escapeHtml(next), 12),
        button(buttonLabel, link),
      ].join(''),
      footer,
    }),
  };
}

/**
 * The waitlist confirmation email (VEN-516, frame 38): sent once, on the
 * first successful details submit. The only receipt a waitlisted vendor gets,
 * so it carries the four facts held and offers reply as the correction
 * channel — the invites need no receipt, they need one button.
 */
export function renderVendorApplicationConfirmationEmail(details: {
  businessName: string;
  categoryName: string;
  city: string;
  state: UsStateCode | null;
  email: string;
}): { subject: string; text: string; html: string } {
  const intro =
    "We saved your details. We'll email you when you're invited. Then sign in with this same address.";
  const where = details.state ? `${details.city}, ${US_STATE_NAMES[details.state]}` : details.city;
  const facts: Array<[string, string]> = [
    ['Business', details.businessName],
    ['Category', details.categoryName],
    ['Where', where],
    ['Email', details.email],
  ];
  const correction = "If any of that is wrong, reply to this email and we'll fix it.";
  const footer = `You signed up to join ${BRAND_NAME} as a vendor.`;

  return {
    subject: `You're on the ${BRAND_NAME} waitlist`,
    text: [
      intro,
      '',
      ...facts.map(([label, value]) => `${label}: ${value}`),
      '',
      correction,
      '',
      footer,
    ].join('\n'),
    html: renderVendorEmailLayout({
      headline: "You're on the waitlist",
      bodyHtml: [
        paragraph(escapeHtml(intro), 14),
        factBox(facts),
        smallParagraph(escapeHtml(correction), 18),
      ].join(''),
      footer,
    }),
  };
}

/**
 * Sends one invite email and records the attempt on the invite, on the handle
 * the caller holds (`tx` when it holds the row's lock). **Never throws for a
 * failed send** — that is recorded, which is what the admin's list shows and
 * what the sweep retries; only a failed write of the record itself propagates.
 * The idempotency key is the same on every attempt, so a retry cannot deliver
 * twice. Returns whether the send itself failed, for a caller that reports it
 * back synchronously (the bulk invite, VEN-513) rather than firing it into the
 * background.
 */
async function sendInviteEmail(
  deps: VendorInviteMailDeps,
  handle: AppDatabase,
  invite: { id: string; email: string },
): Promise<boolean> {
  // Re-read at send time, not stamped onto the invite: a resend or a sweep
  // retry reflects whatever is true when it actually goes out. Outside the
  // `try` below: a failed read here is not a failed *send*, and on a `tx`
  // handle it must abort the caller's transaction rather than be swallowed
  // and recorded as if the gateway had refused the message.
  const hasApplication = (await findApplicationByEmail(handle, invite.email)) !== null;
  let failureReason: string | null = null;

  try {
    await deps.email.send({
      to: invite.email,
      ...renderVendorInviteEmail(deps.webOrigin, invite.email, hasApplication),
      idempotencyKey: `vendor-invite-${invite.id}`,
    });
  } catch (error) {
    // The gateway's message is status-only, so it is safe to store.
    failureReason = error instanceof Error ? error.message : 'The email transport failed';
    deps.log.error({ inviteId: invite.id, err: error }, 'Could not send a vendor invite email');
  }

  await recordInviteEmailAttempt(handle, invite.id, { at: deps.now(), failureReason });

  return failureReason !== null;
}

/** Sends the invite off the request path; a failed send is recorded, never the admin's error. */
function queueInviteEmail(deps: VendorInviteMailDeps, inviteId: string, to: string): void {
  deps.background.run(async () => {
    try {
      await sendInviteEmail(deps, deps.db, { id: inviteId, email: to });
    } catch (error) {
      deps.log.error({ inviteId, err: error }, 'Could not record a vendor invite email attempt');
    }
  });
}

interface ApplicationConfirmationDetails {
  id: string;
  email: string;
  businessName: string;
  categoryName: string;
  city: string;
  state: UsStateCode | null;
}

/** The actual send, shared by the claimed first attempt and every retry. */
async function sendApplicationConfirmationMessage(
  deps: VendorInviteMailDeps,
  application: ApplicationConfirmationDetails,
): Promise<string | null> {
  try {
    await deps.email.send({
      to: application.email,
      ...renderVendorApplicationConfirmationEmail(application),
      idempotencyKey: `vendor-application-confirmation-${application.id}`,
    });

    return null;
  } catch (error) {
    deps.log.error(
      { applicationId: application.id, err: error },
      'Could not send a vendor waitlist confirmation email',
    );

    return error instanceof Error ? error.message : 'The email transport failed';
  }
}

/**
 * Sends the *already-claimed* first attempt: `submitVendorApplication` bumped
 * `confirmation_email_attempts` from 0 to 1 in its own transaction (the atomic
 * claim that makes "first submit" race-free), so this only ever records the
 * **outcome** on top of it — never a second increment, which would burn a
 * retry-budget slot on a send that has not failed yet.
 */
async function sendClaimedApplicationConfirmationEmail(
  deps: VendorInviteMailDeps,
  handle: AppDatabase,
  application: ApplicationConfirmationDetails,
): Promise<void> {
  const failureReason = await sendApplicationConfirmationMessage(deps, application);

  await recordClaimedApplicationEmailOutcome(handle, application.id, {
    at: deps.now(),
    failureReason,
  });
}

/**
 * Sends a retry attempt and records it, incrementing `confirmation_email_attempts`
 * — `sendInviteEmail`'s own shape, for the sweep's own repeated tries.
 */
async function sendApplicationConfirmationEmail(
  deps: VendorInviteMailDeps,
  handle: AppDatabase,
  application: ApplicationConfirmationDetails,
): Promise<void> {
  const failureReason = await sendApplicationConfirmationMessage(deps, application);

  await recordApplicationEmailAttempt(handle, application.id, { at: deps.now(), failureReason });
}

/** Sends the confirmation off the request path; a failed send is recorded, never the submit's error. */
function queueApplicationConfirmationEmail(
  deps: VendorInviteMailDeps,
  application: ApplicationConfirmationDetails,
): void {
  deps.background.run(async () => {
    try {
      await sendClaimedApplicationConfirmationEmail(deps, deps.db, application);
    } catch (error) {
      deps.log.error(
        { applicationId: application.id, err: error },
        'Could not record a vendor waitlist confirmation email attempt',
      );
    }
  });
}

/** How many applications one sweep tick may try, so a Resend outage cannot make a tick unbounded. */
const APPLICATION_CONFIRMATION_RETRY_BATCH = 25;

/**
 * The sweep's third half: re-sends waitlist confirmations whose email failed,
 * `retryFailedInviteEmails`'s own shape. Returns how many it tried.
 */
export async function retryFailedApplicationConfirmationEmails(
  deps: VendorInviteMailDeps,
): Promise<number> {
  const tried: string[] = [];

  while (tried.length < APPLICATION_CONFIRMATION_RETRY_BATCH) {
    const id = await deps.db.transaction(async (tx) => {
      const application = await lockRetryableApplication(tx, {
        now: deps.now(),
        maxAttempts: EMAIL_RETRY_MAX_ATTEMPTS,
        windowMs: EMAIL_RETRY_WINDOW_MS,
        exclude: tried,
      });

      // Only a completed submit ever starts an attempt (`submitVendorApplication`),
      // so every retryable row already carries all four facts.
      if (!application || application.businessName === null || application.category === null) {
        return null;
      }

      await sendApplicationConfirmationEmail(deps, tx, {
        id: application.id,
        email: application.email,
        businessName: application.businessName,
        categoryName: (await resolveCategoryName(tx, application.category)) ?? application.category,
        city: application.city ?? '',
        state: application.state,
      });

      return application.id;
    });

    if (id === null) {
      break;
    }

    tried.push(id);
  }

  return tried.length;
}

/**
 * `POST /admin/vendor-invites/:inviteId/resend`: the admin's retry of an
 * invite whose email did not go out. The same send the sweep makes, under the
 * same row lock — so it waits for a sweep mid-send and then finds the email
 * already sent, rather than sending twice.
 */
export async function resendVendorInvite(
  deps: VendorInviteMailDeps,
  inviteId: string,
): Promise<AdminVendorInviteRow> {
  await deps.db.transaction(async (tx) => {
    const invite = await lockInviteById(tx, inviteId);

    if (!invite) {
      throw notFound('No invite with that id');
    }

    if (invite.acceptedAt) {
      throw conflict('That invite has been used: the vendor account already exists');
    }

    if (invite.emailSentAt) {
      throw conflict('That invite email already went out');
    }

    await sendInviteEmail(deps, tx, invite);
  });

  const row = await findAdminInviteById(deps.db, inviteId);

  if (!row) {
    throw notFound('No invite with that id');
  }

  /*
   * The attempt is recorded (it committed above), but the admin asked for an
   * email to go out and it did not: a 200 would read as success in the console.
   * 502, the provider's failure rather than the admin's.
   */
  if (row.emailStatus === 'failed') {
    throw new AppError(
      502,
      ERROR_CODES.INTERNAL_ERROR,
      'The invite email failed to send again. It stays on the list to retry.',
    );
  }

  return row;
}

/** How many invites one sweep tick may try, so a Resend outage cannot make a tick unbounded. */
const INVITE_RETRY_BATCH = 25;

/**
 * The sweep's half for invites: re-sends unaccepted invites whose email failed,
 * up to `EMAIL_RETRY_MAX_ATTEMPTS` total attempts and only inside
 * `EMAIL_RETRY_WINDOW_MS`, each claimed `FOR UPDATE SKIP LOCKED` so overlapping
 * sweeps send a row once. Returns how many it tried.
 */
export async function retryFailedInviteEmails(deps: VendorInviteMailDeps): Promise<number> {
  const tried: string[] = [];

  while (tried.length < INVITE_RETRY_BATCH) {
    const id = await deps.db.transaction(async (tx) => {
      const invite = await lockRetryableInvite(tx, {
        now: deps.now(),
        maxAttempts: EMAIL_RETRY_MAX_ATTEMPTS,
        windowMs: EMAIL_RETRY_WINDOW_MS,
        exclude: tried,
      });

      if (!invite) {
        return null;
      }

      await sendInviteEmail(deps, tx, invite);

      return invite.id;
    });

    if (id === null) {
      break;
    }

    tried.push(id);
  }

  return tried.length;
}

/**
 * Invites one address, in the caller's transaction: the invite, the audit row,
 * and any application from that address marked invited. `null` when the
 * address was already invited, which writes nothing.
 */
async function inviteAddress(
  tx: AppDatabase,
  actorId: string,
  email: string,
): Promise<AdminVendorInviteRow | null> {
  const invite = await insertInviteIfAbsent(tx, email, actorId);

  if (!invite) {
    return null;
  }

  await markApplicationInvited(tx, email);
  // An empty `detail`: the invite id resolves to the address, and the log is immutable.
  await insertAdminAction(tx, {
    actorId,
    action: 'vendor_invited',
    subjectType: 'vendor_invite',
    subjectId: invite.id,
    detail: {},
  });

  return {
    id: invite.id,
    email: invite.email,
    invitedByName: null,
    createdAt: invite.createdAt,
    acceptedAt: invite.acceptedAt,
    ...inviteEmailState(invite),
  };
}

/** `POST /admin/vendor-invites`. */
export async function createVendorInvite(
  deps: VendorInviteMailDeps,
  actorId: string,
  email: string,
): Promise<AdminVendorInviteRow> {
  if (await hasLiveAccount(deps.db, email)) {
    throw conflict(ACCOUNT_EXISTS_MESSAGE);
  }

  const invite = await deps.db.transaction((tx) => inviteAddress(tx, actorId, email));

  if (!invite) {
    throw conflict('That address is already invited');
  }

  queueInviteEmail(deps, invite.id, invite.email);

  return invite;
}

/** `DELETE /admin/vendor-invites/:inviteId`: withdraws an invite nobody has used. */
export async function revokeVendorInvite(
  db: AppDatabase,
  actorId: string,
  inviteId: string,
): Promise<void> {
  const invite = await findInviteById(db, inviteId);

  if (!invite) {
    throw notFound('No invite with that id');
  }

  if (invite.acceptedAt) {
    throw conflict('That invite has been used: the vendor account already exists');
  }

  await db.transaction(async (tx) => {
    if (!(await deleteUnusedInvite(tx, inviteId))) {
      throw conflict('That invite has been used: the vendor account already exists');
    }

    await restoreApplicationStatus(tx, invite.email);
    await insertAdminAction(tx, {
      actorId,
      action: 'vendor_invite_revoked',
      subjectType: 'vendor_invite',
      subjectId: inviteId,
      detail: {},
    });
  });
}

/** `PUT /admin/vendor-applications/:applicationId`: invite the applicant, or decline them. */
export async function decideVendorApplication(
  deps: VendorInviteMailDeps,
  actorId: string,
  applicationId: string,
  decision: VendorApplicationDecision,
): Promise<AdminVendorApplicationRow> {
  const { application, invite } = await deps.db.transaction(async (tx) => {
    const row = await lockApplication(tx, applicationId);

    if (!row) {
      throw notFound('No application with that id');
    }

    if (row.status === 'invited') {
      throw conflict(
        decision === 'invite'
          ? 'That applicant is already invited'
          : 'That applicant is already invited. Revoke the invite instead.',
      );
    }

    if (decision === 'decline') {
      if (row.status === 'declined') {
        throw conflict('That application is already declined');
      }

      // An invite sent by address still admits them; declining would only hide it.
      if (await lockInviteByEmail(tx, row.email)) {
        throw conflict('That address is already invited. Revoke the invite instead.');
      }

      await setApplicationStatus(tx, { id: row.id }, 'declined');
      await insertAdminAction(tx, {
        actorId,
        action: 'vendor_application_declined',
        subjectType: 'vendor_application',
        subjectId: row.id,
        detail: { before: row.status },
      });

      return { application: { ...row, status: 'declined' as const }, invite: null };
    }

    if (!isVendorApplicationComplete(row)) {
      throw conflict(
        'This applicant has not given a business name, category and city yet. Invite by email instead, or wait for them to finish the form.',
      );
    }

    if (await hasLiveAccount(tx, row.email)) {
      throw conflict(ACCOUNT_EXISTS_MESSAGE);
    }

    const created = await inviteAddress(tx, actorId, row.email);

    // Invited by address already, before this application arrived: only the status was behind.
    if (!created) {
      await markApplicationInvited(tx, row.email);
    }

    return { application: { ...row, status: 'invited' as const }, invite: created };
  });

  if (invite) {
    queueInviteEmail(deps, invite.id, inviteKey(invite.email));
  }

  return {
    id: application.id,
    email: application.email,
    businessName: application.businessName,
    category: application.category,
    categoryName: await resolveCategoryName(deps.db, application.category),
    city: application.city,
    state: application.state,
    message: application.message,
    status: application.status,
    complete: isVendorApplicationComplete(application),
    createdAt: application.createdAt,
  };
}

/**
 * `POST /admin/vendor-applications/invite`: the admin ticks several waitlist
 * rows and invites them in one action (VEN-513).
 *
 * Each id gets its own transaction and, on success, its own synchronous email
 * send — never `decideVendorApplication`'s single throw, because a thrown
 * `AppError` would end the whole request on the first bad id. `inviteAddress`
 * is reused for the write itself, so the audit trail is identical to inviting
 * the same ids one at a time through the single-application route. Ids run in
 * order, one at a time: the risk an email gateway failure is per-address, but
 * sending the whole selection at once would fan it out at the gateway in one
 * burst.
 *
 * An id's status is read fresh under its own row lock rather than trusted from
 * whatever the caller's stale page showed, so a row decided by someone else a
 * moment ago is reported instead of acted on.
 */
export async function bulkInviteApplications(
  deps: VendorInviteMailDeps,
  actorId: string,
  applicationIds: readonly string[],
): Promise<BulkInviteApplicationsResult> {
  const results: BulkInviteResultItem[] = [];

  for (const applicationId of applicationIds) {
    results.push(await bulkInviteOne(deps, actorId, applicationId));
  }

  return { results };
}

async function bulkInviteOne(
  deps: VendorInviteMailDeps,
  actorId: string,
  applicationId: string,
): Promise<BulkInviteResultItem> {
  const outcome = await deps.db.transaction(async (tx) => {
    const row = await lockApplication(tx, applicationId);

    // Unknown, or declined: the admin's own decision, not overridden by a bulk selection.
    if (!row || row.status === 'declined') {
      return { status: 'not_found_or_decided' as const, invite: null };
    }

    if (row.status === 'invited') {
      return { status: 'already_invited' as const, invite: null };
    }

    if (!isVendorApplicationComplete(row)) {
      return { status: 'incomplete' as const, invite: null };
    }

    // An address with an account can never become a vendor (`users.role` is fixed at creation).
    if (await hasLiveAccount(tx, row.email)) {
      return { status: 'not_found_or_decided' as const, invite: null };
    }

    const created = await inviteAddress(tx, actorId, row.email);

    // Invited by address already, before this application arrived: only the status was behind.
    if (!created) {
      await markApplicationInvited(tx, row.email);
      return { status: 'already_invited' as const, invite: null };
    }

    return { status: 'invited' as const, invite: created };
  });

  if (outcome.status !== 'invited') {
    return { id: applicationId, status: outcome.status, emailFailed: false };
  }

  const emailFailed = await sendInviteEmail(deps, deps.db, outcome.invite);

  return { id: applicationId, status: 'invited', emailFailed };
}
