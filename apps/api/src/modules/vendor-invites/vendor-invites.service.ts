import {
  BRAND_NAME,
  ERROR_CODES,
  VENDOR_SIGN_UP_PATH,
  type AdminVendorApplicationList,
  type AdminVendorApplicationRow,
  type AdminVendorInviteList,
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
import {
  deleteUnusedInvite,
  findAdminApplications,
  findAdminInvites,
  findInviteByEmail,
  findInviteById,
  insertInviteIfAbsent,
  inviteKey,
  lockApplication,
  lockInviteByEmail,
  markInviteAccepted,
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
}

export function vendorNotInvited(): AppError {
  return new AppError(
    403,
    ERROR_CODES.VENDOR_NOT_INVITED,
    'Vendor accounts are by invitation for now. No account was created — apply to join, and sign up again with this email once you are invited.',
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

/** `GET /vendor-applications/gate`. */
export async function readVendorSignUpGate(db: AppDatabase): Promise<VendorSignUpGate> {
  const { vendorInviteOnly } = await readPlatformSwitches(db);

  return { vendorInviteOnly };
}

/**
 * `POST /vendor-applications`. The same receipt whether the address was new or
 * already waiting, so the form answers nothing about who else has applied.
 *
 * `sessionEmail` is the caller's Clerk address when they hold a session — the
 * refused vendor the gate sends here — and it replaces whatever the body says.
 */
export async function submitVendorApplication(
  db: AppDatabase,
  body: VendorApplicationInput,
  sessionEmail: string | null,
): Promise<VendorApplicationReceipt> {
  const input = sessionEmail === null ? body : { ...body, email: sessionEmail };
  // Already invited by address: the application arrives decided, so it cannot be declined past the invite.
  const invited = (await findInviteByEmail(db, input.email)) !== null;
  await upsertApplication(db, input, invited ? 'invited' : 'new', sessionEmail !== null);

  return { received: true };
}

export async function listVendorApplications(db: AppDatabase): Promise<AdminVendorApplicationList> {
  return { items: await findAdminApplications(db) };
}

export async function listVendorInvites(db: AppDatabase): Promise<AdminVendorInviteList> {
  return { items: await findAdminInvites(db) };
}

export function renderVendorInviteEmail(webOrigin: string): {
  subject: string;
  text: string;
  html: string;
} {
  const link = `${webOrigin}${VENDOR_SIGN_UP_PATH}`;
  const href = escapeHtml(link);
  const intro = `You're invited to open a vendor account on ${BRAND_NAME}.`;
  const how = 'Sign up with this email address and choose vendor to list your services.';

  return {
    subject: `You're invited to join ${BRAND_NAME} as a vendor`,
    text: [intro, '', how, '', link].join('\n'),
    html: `<p>${escapeHtml(intro)}</p><p>${escapeHtml(how)}</p><p><a href="${href}">${href}</a></p>`,
  };
}

/** Sends the invite off the request path; a failed send is logged, never the operator's error. */
function queueInviteEmail(deps: VendorInviteMailDeps, inviteId: string, to: string): void {
  deps.background.run(async () => {
    try {
      await deps.email.send({
        to,
        ...renderVendorInviteEmail(deps.webOrigin),
        idempotencyKey: `vendor-invite-${inviteId}`,
      });
    } catch (error) {
      deps.log.error({ inviteId, err: error }, 'Could not send a vendor invite email');
    }
  });
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

  await setApplicationStatus(tx, { email }, 'invited');
  await insertAdminAction(tx, {
    actorId,
    action: 'vendor_invited',
    subjectType: 'vendor_invite',
    subjectId: invite.id,
    detail: { email: invite.email },
  });

  return {
    id: invite.id,
    email: invite.email,
    invitedByName: null,
    createdAt: invite.createdAt,
    acceptedAt: invite.acceptedAt,
  };
}

/** `POST /admin/vendor-invites`. */
export async function createVendorInvite(
  deps: VendorInviteMailDeps,
  actorId: string,
  email: string,
): Promise<AdminVendorInviteRow> {
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

    await setApplicationStatus(tx, { email: invite.email }, 'new');
    await insertAdminAction(tx, {
      actorId,
      action: 'vendor_invite_revoked',
      subjectType: 'vendor_invite',
      subjectId: inviteId,
      detail: { email: invite.email },
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
        detail: { email: row.email, before: row.status },
      });

      return { application: { ...row, status: 'declined' as const }, invite: null };
    }

    const created = await inviteAddress(tx, actorId, row.email);

    // Invited by address already, before this application arrived: only the status was behind.
    if (!created) {
      await setApplicationStatus(tx, { id: row.id }, 'invited');
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
