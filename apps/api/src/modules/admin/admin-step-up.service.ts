import { randomUUID } from 'node:crypto';
import {
  ADMIN_CEILING_ACTIONS,
  ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR,
  BRAND_NAME,
  ERROR_CODES,
  STEP_UP_CODE_TTL_MS,
  type AdminStepUpResult,
} from '@vendor-marketplace/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDatabase } from '../../lib/database.js';
import type { EmailGateway } from '../../lib/email.js';
import { AppError, notFound } from '../../lib/errors.js';
import { escapeHtml } from '../../lib/html-escape.js';
import type { StepUpStore } from '../../lib/step-up.js';
import type { OperatorAlerts } from '../operator-alerts/operator-alerts.service.js';
import { findUserById } from '../users/users.dao.js';
import { countAdminActionsSince } from './admin.dao.js';

const HOUR_MS = 60 * 60_000;
const ADMIN_ACTIVITY_PATH = '/admin/activity';

export interface StepUpDeps {
  db: AppDatabase;
  store: StepUpStore;
  email: EmailGateway;
  log: FastifyBaseLogger;
}

/**
 * Emails the operator a code, to the address on **their own account** — never
 * one the request supplies, so a stolen session cannot redirect it.
 *
 * The send is awaited: an operator who asked for a code and never got one
 * must be told, not left to wait. The code is never logged or returned.
 */
export async function startStepUp(
  deps: StepUpDeps,
  adminId: string,
  now: Date,
): Promise<AdminStepUpResult> {
  const admin = await findUserById(deps.db, adminId);

  if (!admin) {
    throw notFound('No account with that id');
  }

  const { code, expiresAt } = deps.store.issue(adminId, now);
  const minutes = STEP_UP_CODE_TTL_MS / 60_000;
  const text = [
    `Your ${BRAND_NAME} confirmation code is ${code}.`,
    `It works for ${minutes} minutes. If you did not ask for it, someone has your session: sign out everywhere and reset your password.`,
  ].join('\n\n');

  try {
    await deps.email.send({
      to: admin.email,
      subject: `${BRAND_NAME} confirmation code`,
      text,
      html: text
        .split('\n\n')
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join(''),
      idempotencyKey: randomUUID(),
    });
  } catch (error) {
    deps.store.cancelChallenge(adminId);
    deps.log.error({ err: error, adminId }, 'The step-up code could not be emailed');
    throw new AppError(
      503,
      ERROR_CODES.INTERNAL_ERROR,
      'We could not send the code. Try again in a moment.',
    );
  }

  return { expiresAt };
}

/** Spends the emailed code. A wrong, spent or expired one is the same refusal. */
export function completeStepUp(
  store: StepUpStore,
  adminId: string,
  code: string,
  now: Date,
): AdminStepUpResult {
  const expiresAt = store.verify(adminId, code, now);

  if (!expiresAt) {
    throw new AppError(
      403,
      ERROR_CODES.STEP_UP_REQUIRED,
      'That code is wrong or has expired. Request a new one.',
    );
  }

  return { expiresAt };
}

/** Destructive actions in flight per operator, which the audit row does not yet show. */
const inFlight = new Map<string, number>();

export interface CeilingDeps {
  db: AppDatabase;
  log: FastifyBaseLogger;
  alerts?: Pick<OperatorAlerts, 'dispatch'> | undefined;
}

/**
 * Runs a ban or closure only while the operator is under the hourly ceiling
 * (VEN-500), and tells the operator when it is not.
 *
 * The audit row lands **last** on a ban, after the refunds, so the count alone
 * would let concurrent requests all read "under" — `inFlight` closes that
 * within an instance. Across replicas it can overshoot by the concurrency, and
 * the step-up store already makes this a single-instance control.
 *
 * The refusal is checked before the work, so no refund is issued for it.
 */
export async function withinDestructiveCeiling<T>(
  deps: CeilingDeps,
  adminId: string,
  now: Date,
  work: () => Promise<T>,
): Promise<T> {
  /*
   * An unreadable audit log must not take the ban lever with it: the ban
   * itself already survives a failed audit write (`recordAdminActionBestEffort`),
   * and refusing every suspension while the log is down would trade a
   * stolen-session bound for an outage of the one response to abuse. The
   * in-flight count still applies, and the failure is loud.
   */
  const completed = await countAdminActionsSince(
    deps.db,
    adminId,
    ADMIN_CEILING_ACTIONS,
    new Date(now.getTime() - HOUR_MS),
  ).catch((error: unknown) => {
    deps.log.error({ err: error, adminId }, 'The hourly ceiling could not read the action log');
    return 0;
  });
  const pending = inFlight.get(adminId) ?? 0;

  if (completed + pending >= ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR) {
    deps.alerts?.dispatch({
      kind: 'launch_switch_flipped',
      // Once per operator per dedupe window, however hard they keep pressing.
      subjectId: `ceiling:${adminId}`,
      summary: 'An operator reached the hourly ban and closure ceiling',
      details: [
        `Operator: ${adminId}`,
        `Limit: ${ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR} bans and closures per hour`,
        'The next one was refused. If this was not them, their session is stolen.',
      ],
      adminPath: ADMIN_ACTIVITY_PATH,
    });

    throw new AppError(
      429,
      ERROR_CODES.ADMIN_CEILING_REACHED,
      'You have reached the hourly limit for bans and closures. Try again later.',
    );
  }

  inFlight.set(adminId, pending + 1);

  try {
    return await work();
  } finally {
    const remaining = (inFlight.get(adminId) ?? 1) - 1;
    if (remaining <= 0) {
      inFlight.delete(adminId);
    } else {
      inFlight.set(adminId, remaining);
    }
  }
}
