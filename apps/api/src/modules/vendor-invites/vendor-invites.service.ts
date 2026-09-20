import {
  BRAND_NAME,
  EMAIL_RETRY_MAX_ATTEMPTS,
  EMAIL_RETRY_WINDOW_MS,
  ERROR_CODES,
  VENDOR_SIGN_UP_PATH,
  type AdminVendorApplicationList,
  type AdminVendorApplicationRow,
  type AdminVendorInviteList,
  type AdminVendorInviteQuery,
  type AdminVendorInviteRow,
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
import { AppError, conflict, notFound } from '../../lib/errors.js';
import { escapeHtml } from '../../lib/html-escape.js';
import { insertAdminAction } from '../admin/admin.dao.js';
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
  restoreApplicationStatus,
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
    'Vendor accounts are by invitation for now. No account was created — apply to join, then sign in with this same email once you are invited.',
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
 * The role for a first acceptance that carries no chosen one: `vendor` for an
 * address with an unused invite, otherwise nothing (so `normalizeRole` narrows
 * to customer).
 *
 * The chosen role travels in the browser for 24 hours only, and the invite email
 * tells a refused vendor to sign in rather than sign up again. Without this, an
 * invitee who signs in after that window is made a customer for good.
 */
export async function invitedRoleHint(
  db: AppDatabase,
  email: string,
): Promise<'vendor' | undefined> {
  const invite = await findInviteByEmail(db, email);

  return invite && invite.acceptedAt === null ? 'vendor' : undefined;
}

/** `GET /vendor-applications/gate`. */
export async function readVendorSignUpGate(db: AppDatabase): Promise<VendorSignUpGate> {
  const { vendorInviteOnly } = await readPlatformSwitches(db);

  return { vendorInviteOnly };
}

/**
 * `POST /vendor-applications`. The same receipt whether the address was new or
 * already waiting, so the form answers nothing about who else has applied.
 *
 * `sessionEmail` is the caller's auth address when they hold a session — the
 * refused vendor the gate sends here — and it replaces whatever the body says.
 */
export async function submitVendorApplication(
  db: AppDatabase,
  body: VendorApplicationInput,
  sessionEmail: string | null,
): Promise<VendorApplicationReceipt> {
  const input = sessionEmail === null ? body : { ...body, email: sessionEmail };

  /*
   * An address with an account can never become a vendor (`users.role` is fixed at
   * creation), so an application from it could only wait forever. A signed-in
   * caller is told; a signed-out one gets the uniform receipt, because the form
   * must not answer whether an address is registered.
   */
  if (await hasLiveAccount(db, input.email)) {
    if (sessionEmail !== null) {
      throw conflict(ACCOUNT_EXISTS_MESSAGE);
    }

    return { received: true };
  }

  // Already invited by address: the application arrives decided, so it cannot be declined past the invite.
  const invited = (await findInviteByEmail(db, input.email)) !== null;
  await upsertApplication(db, input, invited ? 'invited' : 'new', sessionEmail !== null);

  return { received: true };
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
    city: application.city,
    message: application.message,
    status: application.status,
    createdAt: application.createdAt,
  };
}
