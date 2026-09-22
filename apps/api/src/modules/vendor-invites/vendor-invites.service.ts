import {
  BRAND_NAME,
  EMAIL_RETRY_MAX_ATTEMPTS,
  EMAIL_RETRY_WINDOW_MS,
  ERROR_CODES,
  VENDOR_SIGN_UP_PATH,
  isVendorApplicationComplete,
  type AdminVendorApplicationList,
  type AdminVendorApplicationRow,
  type AdminVendorInviteList,
  type AdminVendorInviteQuery,
  type AdminVendorInviteRow,
  type MyVendorApplication,
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
import { findActiveCategoryIds } from '../vendors/vendors.dao.js';
import {
  readPlatformSwitches,
  readPlatformSwitchesUncached,
} from '../platform-settings/platform-settings.service.js';
import type { Clock } from '../../plugins/clock.js';
import {
  deleteUnusedInvite,
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
  lockRetryableInvite,
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
 * address the operator has invited. A customer is never asked.
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
  'That address already has an account, and an account cannot become a vendor. Use a different email address to apply.';

export function vendorNotInvited(): AppError {
  return new AppError(
    403,
    ERROR_CODES.VENDOR_NOT_INVITED,
    "Vendor accounts are by invitation for now. No account was created, but you're on the waitlist — tell us about your business and we'll invite you.",
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
): Promise<never> {
  if (error instanceof AppError && error.code === ERROR_CODES.VENDOR_NOT_INVITED) {
    /*
     * An address with a live account is refused by `hasLiveAccount` wherever
     * it later tries to complete the waitlist, so a row for it would sit on
     * the operator's list unable ever to be invited. The only caller this can
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
      await seedApplication(db, email).catch(() => undefined);
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
  db: AppDatabase,
  body: VendorApplicationInput,
  sessionEmail: string,
): Promise<VendorApplicationReceipt> {
  const input = { ...body, email: sessionEmail };

  // An address with an account can never become a vendor (`users.role` is fixed at creation).
  if (await hasLiveAccount(db, input.email)) {
    throw conflict(ACCOUNT_EXISTS_MESSAGE);
  }

  if ((await findActiveCategoryIds(db, [input.category])).length === 0) {
    throw validationFailed(
      'That category is not available. Reload and choose from the current list.',
      { field: 'category' },
    );
  }

  // Already invited by address: the application arrives decided, so it cannot be declined past the invite.
  const invited = (await findInviteByEmail(db, input.email)) !== null;
  await upsertApplication(db, input, invited ? 'invited' : 'new', true);

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

export function renderVendorInviteEmail(webOrigin: string): {
  subject: string;
  text: string;
  html: string;
} {
  const link = `${webOrigin}${VENDOR_SIGN_UP_PATH}`;
  const href = escapeHtml(link);
  const intro = `You're invited to open a vendor account on ${BRAND_NAME}.`;
  const how =
    'Sign up with this email address and choose vendor to list your services. If you already signed up with it, sign in instead: your vendor account opens then.';

  return {
    subject: `You're invited to join ${BRAND_NAME} as a vendor`,
    text: [intro, '', how, '', link].join('\n'),
    html: `<p>${escapeHtml(intro)}</p><p>${escapeHtml(how)}</p><p><a href="${href}">${href}</a></p>`,
  };
}

/**
 * Sends one invite email and records the attempt on the invite, on the handle
 * the caller holds (`tx` when it holds the row's lock). **Never throws for a
 * failed send** — that is recorded, which is what the operator's list shows and
 * what the sweep retries; only a failed write of the record itself propagates.
 * The idempotency key is the same on every attempt, so a retry cannot deliver
 * twice.
 */
async function sendInviteEmail(
  deps: VendorInviteMailDeps,
  handle: AppDatabase,
  invite: { id: string; email: string },
): Promise<void> {
  let failureReason: string | null = null;

  try {
    await deps.email.send({
      to: invite.email,
      ...renderVendorInviteEmail(deps.webOrigin),
      idempotencyKey: `vendor-invite-${invite.id}`,
    });
  } catch (error) {
    // The gateway's message is status-only, so it is safe to store.
    failureReason = error instanceof Error ? error.message : 'The email transport failed';
    deps.log.error({ inviteId: invite.id, err: error }, 'Could not send a vendor invite email');
  }

  await recordInviteEmailAttempt(handle, invite.id, { at: deps.now(), failureReason });
}

/** Sends the invite off the request path; a failed send is recorded, never the operator's error. */
function queueInviteEmail(deps: VendorInviteMailDeps, inviteId: string, to: string): void {
  deps.background.run(async () => {
    try {
      await sendInviteEmail(deps, deps.db, { id: inviteId, email: to });
    } catch (error) {
      deps.log.error({ inviteId, err: error }, 'Could not record a vendor invite email attempt');
    }
  });
}

/**
 * `POST /admin/vendor-invites/:inviteId/resend`: the operator's retry of an
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
   * The attempt is recorded (it committed above), but the operator asked for an
   * email to go out and it did not: a 200 would read as success in the console.
   * 502, the provider's failure rather than the operator's.
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
          : 'That applicant is already invited; revoke the invite instead',
      );
    }

    if (decision === 'decline') {
      if (row.status === 'declined') {
        throw conflict('That application is already declined');
      }

      // An invite sent by address still admits them; declining would only hide it.
      if (await lockInviteByEmail(tx, row.email)) {
        throw conflict('That address is already invited; revoke the invite instead');
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
        'This applicant has not given a business name, category and city yet — invite by email instead, or wait for them to finish the form.',
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
