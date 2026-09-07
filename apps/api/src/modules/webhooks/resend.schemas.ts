import { z } from 'zod';
import { stripBidiControls } from '@vendor-marketplace/shared';

/**
 * A bounce diagnostic, crossing the same boundary every stored free text does.
 *
 * This is the one field on the payload that is written by **neither Resend nor
 * this platform** — it is the receiving mail server's own message, quoted
 * verbatim, and any address on a domain the reader controls can decide what it
 * says. `request-body-free-text.test.ts` enforces `stripBidiControls` on every
 * schema a route *attaches as a request body*, and it structurally cannot see
 * this one: the webhook parses its body by hand, because svix signs the exact
 * bytes. So the boundary is applied here, explicitly, for the reason that guard
 * exists — a `U+202E` in a stored diagnostic reorders the line around it
 * wherever #437 renders the column (#398, one hop further out).
 *
 * Deliberately **not** `.max()`. Width belongs to the DAO, which truncates on
 * both write paths — and rejecting an over-long diagnostic here would answer
 * 400 to an event that is perfectly valid, putting Resend into a retry loop it
 * can never clear. A mail server's message length is its own decision, not a
 * reason to refuse the bounce it is telling us about.
 */
const bounceText = () => z.string().overwrite(stripBidiControls).trim();

/**
 * As much of Resend's delivery event as this platform reads, and **no more**.
 *
 * Zod strips what it does not declare, so the `subject`, `from` and `to` that
 * every one of these events carries never reach a variable, let alone the
 * table. That is the schema doing the enforcing rather than a reviewer: #439
 * forbids storing the message, and the way to keep that true is for the code
 * never to hold it.
 *
 * `type` is a plain string rather than an enum of the three that matter.
 * Resend adds event types, and an unknown one has to parse in order to be
 * *ignored* — refusing it as malformed would answer 400 and put a permanently
 * failing endpoint in the provider's dashboard for an event that was never
 * ours to act on.
 */
export const resendEventSchema = z.object({
  type: z.string().min(1),
  created_at: z.string().min(1).optional(),
  data: z.object({
    email_id: z.string().min(1),
    created_at: z.string().min(1).optional(),
    /** Present on `email.bounced` only; the receiving server's own diagnosis. */
    bounce: z
      .object({
        message: bounceText().optional(),
        type: bounceText().optional(),
        subType: bounceText().optional(),
      })
      .optional(),
  }),
});

export type ResendEvent = z.infer<typeof resendEventSchema>;
