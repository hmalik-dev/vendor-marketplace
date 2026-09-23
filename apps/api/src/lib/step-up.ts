import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { stepUpChallenges, stepUpGrants } from '@vendor-marketplace/db/schema';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { onRequestAsyncHookHandler } from 'fastify';
import {
  ERROR_CODES,
  STEP_UP_CODE_LENGTH,
  STEP_UP_CODE_TTL_MS,
  STEP_UP_GRANT_TTL_MS,
  STEP_UP_MAX_ATTEMPTS,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from './database.js';
import { AppError } from './errors.js';
import { authenticated } from './guards.js';

export interface IssuedChallenge {
  /** Emailed to the operator and never stored, logged or returned. */
  readonly code: string;
  readonly expiresAt: Date;
}

/**
 * A fresh re-authentication for irreversible admin routes (VEN-500).
 *
 * The operator proves control of their **mailbox** again: a code is emailed,
 * entered, and a grant is held for {@link STEP_UP_GRANT_TTL_MS}. A stolen
 * session token alone cannot mint one, and it needs no provider capability —
 * Neon Auth has no second factor. Reused by every irreversible route, and by
 * VEN-506's operator grant and revoke, through {@link requireStepUp}.
 *
 * **In Postgres, so every instance agrees** (VEN-650): a code issued through
 * one replica is spent through another, and a grant minted on one is honoured
 * by all of them. Only the SHA-256 of a code is stored.
 */
export class StepUpStore {
  readonly #db: AppDatabase;

  constructor(db: AppDatabase) {
    this.#db = db;
  }

  /** Replaces any earlier challenge for this operator, so only the newest code works. */
  async issue(adminId: string, now: Date): Promise<IssuedChallenge> {
    const code = String(randomInt(10 ** STEP_UP_CODE_LENGTH)).padStart(STEP_UP_CODE_LENGTH, '0');
    const expiresAt = new Date(now.getTime() + STEP_UP_CODE_TTL_MS);
    const challenge = { digest: digestOf(code), attempts: 0, expiresAt };

    await this.#db
      .insert(stepUpChallenges)
      .values({ adminId, ...challenge })
      .onConflictDoUpdate({ target: stepUpChallenges.adminId, set: challenge });

    return { code, expiresAt };
  }

  /**
   * Spends the challenge on a correct code and returns when the grant lapses,
   * or `null`. A wrong code counts an attempt; the last allowed one voids the
   * challenge, so the six-digit space cannot be walked.
   *
   * The attempt is counted by the statement that reads the challenge, so two
   * replicas guessing at once each spend one; and the challenge is spent with
   * a `delete … returning`, so of two correct entries only one mints a grant.
   */
  async verify(adminId: string, code: string, now: Date): Promise<Date | null> {
    const [challenge] = await this.#db
      .update(stepUpChallenges)
      .set({ attempts: sql`${stepUpChallenges.attempts} + 1` })
      .where(
        and(
          eq(stepUpChallenges.adminId, adminId),
          gt(stepUpChallenges.expiresAt, now),
          // Concurrent guesses each count, and none past the cap is compared.
          lt(stepUpChallenges.attempts, STEP_UP_MAX_ATTEMPTS),
        ),
      )
      .returning({ digest: stepUpChallenges.digest, attempts: stepUpChallenges.attempts });

    if (!challenge) {
      await this.cancelChallenge(adminId);
      return null;
    }

    const presented = digestOf(code);

    if (!timingSafeEqual(Buffer.from(challenge.digest, 'hex'), Buffer.from(presented, 'hex'))) {
      if (challenge.attempts >= STEP_UP_MAX_ATTEMPTS) {
        await this.cancelChallenge(adminId);
      }
      return null;
    }

    const expiresAt = new Date(now.getTime() + STEP_UP_GRANT_TTL_MS);

    return this.#db.transaction(async (tx) => {
      const spent = await tx
        .delete(stepUpChallenges)
        .where(and(eq(stepUpChallenges.adminId, adminId), eq(stepUpChallenges.digest, presented)))
        .returning({ adminId: stepUpChallenges.adminId });

      if (spent.length === 0) {
        return null;
      }

      await tx
        .insert(stepUpGrants)
        .values({ adminId, expiresAt })
        .onConflictDoUpdate({ target: stepUpGrants.adminId, set: { expiresAt } });

      return expiresAt;
    });
  }

  async isFresh(adminId: string, now: Date): Promise<boolean> {
    const [grant] = await this.#db
      .select({ adminId: stepUpGrants.adminId })
      .from(stepUpGrants)
      .where(and(eq(stepUpGrants.adminId, adminId), gt(stepUpGrants.expiresAt, now)));

    return grant !== undefined;
  }

  /** Ends a grant early — after the destructive action it was minted for, if a caller wants one-shot. */
  async revoke(adminId: string): Promise<void> {
    await this.#db.transaction(async (tx) => {
      await tx.delete(stepUpGrants).where(eq(stepUpGrants.adminId, adminId));
      await tx.delete(stepUpChallenges).where(eq(stepUpChallenges.adminId, adminId));
    });
  }

  /** Voids a pending code — the send failed — and leaves any live grant alone. */
  async cancelChallenge(adminId: string): Promise<void> {
    await this.#db.delete(stepUpChallenges).where(eq(stepUpChallenges.adminId, adminId));
  }
}

/** Stored instead of the code, so a database dump holds no usable credential. */
function digestOf(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function stepUpRequired(): AppError {
  return new AppError(
    403,
    ERROR_CODES.STEP_UP_REQUIRED,
    'Confirm it is you: enter the code we emailed you, then try again.',
  );
}

/**
 * Route guard: a fresh step-up. **List it after the role guard** —
 * `onRequest: [adminOnly, requireStepUp]` — so a caller with the wrong role
 * hears 403 without learning the route asks for more, and both run before
 * validation like every guard on the plugin (VEN-548). It reads `request.auth`
 * and keys the grant on the local user id, never on anything the body says.
 */
export const requireStepUp: onRequestAsyncHookHandler = async (request) => {
  const user = authenticated(request.auth);

  if (!(await request.server.stepUp.isFresh(user.id, request.server.clock()))) {
    throw stepUpRequired();
  }
};
