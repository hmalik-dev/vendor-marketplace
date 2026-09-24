import { emailSendDays } from '@vendor-marketplace/db/schema';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { AppDatabase } from './database.js';
import { EmailQuotaExceededError, type EmailGateway } from './email.js';
import type { ErrorReporter } from './error-reporting.js';

/** Why a day stopped sending: our own ceiling, or Resend's quota. */
export type SendingClosedReason = 'cap' | 'quota';

/**
 * A send refused because the day is closed (VEN-661).
 *
 * Thrown without touching Resend, so a retry loop that meets it costs a query,
 * not a quota slot. Callers that retry on their own — `alertNow` — stop on it.
 */
export class EmailSendingClosedError extends Error {
  constructor(
    readonly reason: SendingClosedReason,
    readonly day: string,
  ) {
    super(
      reason === 'cap'
        ? `Email sending is closed for ${day}: EMAIL_DAILY_SEND_CAP is reached`
        : `Email sending is closed for ${day}: the Resend quota is spent`,
    );
    this.name = 'EmailSendingClosedError';
  }
}

/**
 * Slots past the cap that only `essential` mail may take: 80 + 15 stays under
 * Resend's 100 a day, and the admin's step-up codes and alerts still go out
 * on a day ordinary mail has spent.
 */
export const ESSENTIAL_SEND_HEADROOM = 15;

/** The budget's day. UTC, so every instance and every time zone agree on it. */
export function sendDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Takes one slot of `day`'s budget, or answers false when the day is closed or
 * already at `cap`.
 *
 * An `essential` send ignores a `cap` closure and may go `ESSENTIAL_SEND_HEADROOM`
 * past it; a `quota` closure refuses it like any other.
 *
 * One conditional upsert, so two instances cannot both take the last slot: the
 * conflict locks the row and the `WHERE` is re-checked against its latest value.
 */
export async function reserveSend(
  db: AppDatabase,
  day: string,
  cap: number,
  essential = false,
): Promise<boolean> {
  const rows = await db
    .insert(emailSendDays)
    .values({ day, sent: 1 })
    .onConflictDoUpdate({
      target: emailSendDays.day,
      set: { sent: sql`${emailSendDays.sent} + 1` },
      setWhere: essential
        ? and(
            or(isNull(emailSendDays.closedReason), eq(emailSendDays.closedReason, 'cap')),
            lt(emailSendDays.sent, cap + ESSENTIAL_SEND_HEADROOM),
          )
        : and(isNull(emailSendDays.closedReason), lt(emailSendDays.sent, cap)),
    })
    .returning({ sent: emailSendDays.sent });

  return rows.length > 0;
}

/** Closes `day` for `reason`. True only for the call that closed it, which is the one that pages. */
export async function closeSendDay(
  db: AppDatabase,
  day: string,
  reason: SendingClosedReason,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .insert(emailSendDays)
    .values({ day, closedReason: reason, closedAt: now })
    .onConflictDoUpdate({
      target: emailSendDays.day,
      set: { closedReason: reason, closedAt: now },
      setWhere: isNull(emailSendDays.closedReason),
    })
    .returning({ day: emailSendDays.day });

  return rows.length > 0;
}

/**
 * Reopens `day` when it was closed by a cap lower than `cap` — the boot after the
 * admin raised `EMAIL_DAILY_SEND_CAP`, which is a redeploy. A `quota` closure
 * stays: only Resend can lift that.
 */
export async function reopenCapClosedDay(
  db: AppDatabase,
  day: string,
  cap: number,
): Promise<boolean> {
  const rows = await db
    .update(emailSendDays)
    .set({ closedReason: null, closedAt: null })
    .where(
      and(
        eq(emailSendDays.day, day),
        eq(emailSendDays.closedReason, 'cap'),
        lt(emailSendDays.sent, cap),
      ),
    )
    .returning({ day: emailSendDays.day });

  return rows.length > 0;
}

/** Why `day` is closed, or null while it still sends. */
export async function sendDayClosedReason(
  db: AppDatabase,
  day: string,
): Promise<SendingClosedReason | null> {
  const [row] = await db
    .select({ reason: emailSendDays.closedReason })
    .from(emailSendDays)
    .where(eq(emailSendDays.day, day))
    .limit(1);

  return row?.reason ?? null;
}

export interface DailySendCapOptions {
  db: AppDatabase;
  /** Sends per UTC day, at least 1; a cap of 0 is a log-only gateway, not this one. */
  cap: number;
  clock: () => Date;
  reporter: ErrorReporter;
  log: { error(obj: object, msg: string): void };
}

/**
 * Holds `gateway` to `cap` sends per UTC day, and shuts the day when Resend says
 * its quota is spent (VEN-661).
 *
 * A slot is reserved before the send and kept whatever the provider answers:
 * the count is of attempts, which errs towards stopping early, and an attempt
 * that timed out may well have been delivered. The first refusal of a day logs
 * by name and pages Sentry; every later one is quiet, because the page has
 * already said everything the next hundred would.
 */
export function withDailySendCap(
  gateway: EmailGateway,
  options: DailySendCapOptions,
): EmailGateway {
  const { db, cap, clock, reporter, log } = options;

  async function close(day: string, reason: SendingClosedReason): Promise<never> {
    const error = new EmailSendingClosedError(reason, day);

    if (await closeSendDay(db, day, reason, clock())) {
      log.error({ day, reason, cap }, error.message);
      reporter.capture(error);
      throw error;
    }

    // Closed already, possibly for the other reason; report the one that stands.
    throw new EmailSendingClosedError((await sendDayClosedReason(db, day)) ?? reason, day);
  }

  return {
    async send(message) {
      const day = sendDay(clock());
      const essential = message.essential === true;
      let reserved: boolean;

      try {
        reserved = await reserveSend(db, day, cap, essential);
      } catch (error) {
        /*
         * The database is down — the likeliest moment for an admin alert —
         * and `alertNow` already sends unrecorded then (VEN-430). Essential mail
         * goes out uncounted; everything else fails as it would have anyway.
         */
        if (!essential) {
          throw error;
        }

        log.error(
          { day, err: error },
          'Could not reserve an email send; sending essential mail uncounted',
        );
        reserved = true;
      }

      if (!reserved) {
        return close(day, 'cap');
      }

      try {
        return await gateway.send(message);
      } catch (error) {
        if (error instanceof EmailQuotaExceededError) {
          return close(day, 'quota');
        }

        throw error;
      }
    },
  };
}
