import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { onRequestAsyncHookHandler } from 'fastify';
import {
  ERROR_CODES,
  STEP_UP_CODE_LENGTH,
  STEP_UP_CODE_TTL_MS,
  STEP_UP_GRANT_TTL_MS,
  STEP_UP_MAX_ATTEMPTS,
} from '@vendor-marketplace/shared';
import { AppError } from './errors.js';
import { authenticated } from './guards.js';

interface PendingChallenge {
  readonly digest: Buffer;
  readonly expiresAtMs: number;
  attempts: number;
}

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
 * **In memory, so a single-instance assumption** — the same one
 * `StreamTicketStore` and the rate limiter record in
 * `vendor-marketplace-decisions.md`. On a second replica the operator simply
 * asks for another code; the failure is a re-prompt, never an open door.
 */
export class StepUpStore {
  readonly #challenges = new Map<string, PendingChallenge>();
  readonly #grants = new Map<string, number>();

  /** Replaces any earlier challenge for this operator, so only the newest code works. */
  issue(adminId: string, now: Date): IssuedChallenge {
    this.#sweep(now.getTime());

    const code = String(randomInt(10 ** STEP_UP_CODE_LENGTH)).padStart(STEP_UP_CODE_LENGTH, '0');
    const expiresAtMs = now.getTime() + STEP_UP_CODE_TTL_MS;

    this.#challenges.set(adminId, { digest: digestOf(code), expiresAtMs, attempts: 0 });

    return { code, expiresAt: new Date(expiresAtMs) };
  }

  /**
   * Spends the challenge on a correct code and returns when the grant lapses,
   * or `null`. A wrong code counts an attempt; the last allowed one voids the
   * challenge, so the six-digit space cannot be walked.
   */
  verify(adminId: string, code: string, now: Date): Date | null {
    const nowMs = now.getTime();
    const challenge = this.#challenges.get(adminId);

    if (!challenge || challenge.expiresAtMs <= nowMs) {
      this.#challenges.delete(adminId);
      return null;
    }

    challenge.attempts += 1;

    if (!timingSafeEqual(challenge.digest, digestOf(code))) {
      if (challenge.attempts >= STEP_UP_MAX_ATTEMPTS) {
        this.#challenges.delete(adminId);
      }
      return null;
    }

    this.#challenges.delete(adminId);
    const expiresAtMs = nowMs + STEP_UP_GRANT_TTL_MS;
    this.#grants.set(adminId, expiresAtMs);

    return new Date(expiresAtMs);
  }

  isFresh(adminId: string, now: Date): boolean {
    return (this.#grants.get(adminId) ?? 0) > now.getTime();
  }

  /** Ends a grant early — after the destructive action it was minted for, if a caller wants one-shot. */
  revoke(adminId: string): void {
    this.#grants.delete(adminId);
    this.#challenges.delete(adminId);
  }

  /** Voids a pending code — the send failed — and leaves any live grant alone. */
  cancelChallenge(adminId: string): void {
    this.#challenges.delete(adminId);
  }

  #sweep(nowMs: number): void {
    for (const [id, challenge] of this.#challenges) {
      if (challenge.expiresAtMs <= nowMs) {
        this.#challenges.delete(id);
      }
    }
    for (const [id, expiresAtMs] of this.#grants) {
      if (expiresAtMs <= nowMs) {
        this.#grants.delete(id);
      }
    }
  }
}

/** Stored instead of the code, so a heap dump holds no usable credential. */
function digestOf(code: string): Buffer {
  return createHash('sha256').update(code).digest();
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

  if (!request.server.stepUp.isFresh(user.id, request.server.clock())) {
    throw stepUpRequired();
  }
};
