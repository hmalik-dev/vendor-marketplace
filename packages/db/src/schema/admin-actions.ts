import { sql } from 'drizzle-orm';
import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
  ADMIN_ACTION_SUBJECTS,
  ADMIN_ACTIONS,
  type AdminActionDetail,
} from '@vendor-marketplace/shared';
import { users } from './users.js';

export const adminActionEnum = pgEnum('admin_action', ADMIN_ACTIONS);
export const adminActionSubjectEnum = pgEnum('admin_action_subject', ADMIN_ACTION_SUBJECTS);

/**
 * One row per mutation the operations console makes, and **it is never updated
 * and never deleted**.
 *
 * The console reads and writes other people's accounts and money by design.
 * Before this table the whole record of that was two `log.info` lines — one for
 * a ban, one for a review deletion — and three of the six mutating routes were
 * never even passed the acting operator's id. "Which operator suspended this
 * account, and when" had no queryable answer anywhere, which is the
 * accountability gap under every later moderation feature.
 *
 * **Immutable the way `legal_acceptances` is immutable**, by the triggers the
 * migration installs rather than by a DAO that happens to have no update
 * method. A rule kept in application code is one every new writer has to
 * remember, and an audit log that the code writing to it can also rewrite
 * records nothing. The invariant is `0029_sad_storm.sql`'s, exactly: **a row
 * can never be altered, and can never be removed while the operator it is
 * about still exists.**
 *
 * Three deliberate consequences of that:
 *
 * - `actor_id` cascades, and that is the one delete the trigger allows —
 *   erasing an operator's whole account takes their rows with it, because a
 *   recorded action with nobody behind it names nobody. It is not a way to
 *   launder the log: `users` rows in this product are **retired, never
 *   removed** (`deleted_at`), so no product path reaches that cascade at all.
 *   What is made impossible is tampering — an edit, or a row quietly dropped
 *   out from under a serving operator.
 * - `subject_id` carries **no foreign key at all**, which is why
 *   `subject_type` has to be stored beside it. A review deletion whose row
 *   cascaded away with the review would erase the only evidence the deletion
 *   ever happened. The subject is the thing most likely to be deleted next,
 *   and the record has to survive it.
 * - There is no `updated_at`, because there is no update.
 *
 * **What must never be written here.** `detail` records *what changed*, never
 * the content of what was moderated: no message bodies, no review text, no
 * email addresses beyond the ids that resolve to them, no card or Stripe
 * secrets. A moderation log that quotes the abuse is a second copy of the
 * abuse, held for longer and read by more people. The flat-scalar shape of
 * `AdminActionDetail` is what makes nesting a whole entity in here unwritable
 * rather than merely discouraged.
 */
export const adminActions = pgTable(
  'admin_actions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    /** The operator. The one cascade the trigger lets through — see above. */
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: adminActionEnum('action').notNull(),
    subjectType: adminActionSubjectEnum('subject_type').notNull(),
    /** Intentionally unconstrained — see the note on outliving its subject. */
    subjectId: uuid('subject_id').notNull(),
    detail: jsonb('detail').$type<AdminActionDetail>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /*
     * Every one of these is `DESC` **and therefore `NULLS LAST`**, because that
     * is what Drizzle's index builder emits — and the reader has to ask for the
     * same thing or none of them is usable.
     *
     * Postgres treats `DESC` and `DESC NULLS LAST` as different pathkeys and
     * does not special-case a `NOT NULL` column, so a plain `ORDER BY
     * created_at DESC` cannot be satisfied by any index below. Measured on the
     * Docker Postgres at 50k rows: the unfiltered page went from a top-N
     * heapsort over 624 buffers to an index scan over 13, and the actor page
     * from 626 buffers to 14. `findAdminActions` therefore spells the nulls
     * ordering out; see the comment there.
     */

    /* The unfiltered feed: newest first, which is the only order this is read in. */
    index('admin_actions_created_at_idx').on(table.createdAt.desc()),
    /* "What did this operator do." */
    index('admin_actions_actor_idx').on(table.actorId, table.createdAt.desc()),
    /*
     * "What did the console do to this account." Subject id first: it is the
     * selective half, and a filter by subject never supplies a type without it.
     */
    index('admin_actions_subject_idx').on(table.subjectId, table.createdAt.desc()),
    /*
     * The screen's only dropdown, and the one index whose worth depends on
     * which action you pick — which is why it is here on measurement rather
     * than on symmetry.
     *
     * Filtering on a **common** action needs no index at all: the `created_at`
     * scan above finds 25 matches almost immediately (3 buffers). Filtering on
     * a **rare** one is the opposite — the planner gives up on that index and
     * seq-scans. Measured at 50k rows with 30 `dispute_resolved` among them:
     * 621 buffers without this index, 3 with it. A dispute resolution is
     * exactly the rare, consequential row somebody comes looking for.
     */
    index('admin_actions_action_idx').on(table.action, table.createdAt.desc()),
  ],
);

export type AdminActionRow = typeof adminActions.$inferSelect;
export type NewAdminActionRow = typeof adminActions.$inferInsert;
