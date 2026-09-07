---
name: admin-action-log-is-trigger-immutable
description: admin_actions is append-only by Postgres trigger; its one DELETE exception, its search_path pinning and its detail-payload exclusions are settled — do not re-report them
metadata:
  type: project
---

`admin_actions` (#434, `packages/db/drizzle/0030_faithful_tomorrow_man.sql`) is
immutable by trigger, not by convention, and the shape was audited and cleared.

**Why:** the console's whole purpose is acting on other people's accounts and
money, so the log is the security asset rather than a byproduct. Every
tampering shape was closed deliberately and each has a test that attempts the
write rather than reading the DDL (`packages/db/src/admin-action-immutability.test.ts`,
8 tests, verified green 2026-09-07).

What is settled, so a later pass does not relitigate it:

- **UPDATE, DELETE and TRUNCATE all raise.** `TRUNCATE` needs its own
  `FOR EACH STATEMENT` function because a row trigger never sees it — and
  `TRUNCATE users CASCADE` is refused by that same statement trigger.
- **The one permitted DELETE is the `actor_id` cascade**, allowed only while the
  actor's `users` row is already gone. It is unreachable from the product:
  `user.deleted` and the Clerk reconcile pass both go through
  `softDeleteUserByClerkId` (`deleted_at`), and the only hard `delete(users)`
  calls are seed teardowns scoped to their own `DEMO_SEED_PREFIX` /
  `seed_mkt_` clerk ids. If a hard delete of a real `users` row is ever
  introduced, that becomes a log-laundering path — that is the thing to
  re-check, not the trigger.
- **`SET search_path = pg_catalog, public` is on both functions and is
  load-bearing**, not hygiene: the DELETE guard reads `public.users`, and a
  `SECURITY INVOKER` function without it is defeated by `CREATE SCHEMA evil;
CREATE TABLE evil.users(id uuid); SET search_path = evil, public`. There is a
  test that runs exactly that.
- **`subject_id` carries no foreign key on purpose** — the record must outlive
  the review, booking or account it is about.
- **`detail` deliberately excludes `adminNote`, review text, message bodies and
  emails.** Only ids, counts, enum members and platform-computed money figures.
  The `tag_updated` payload does carry the tag `name`/`previousName`; that was
  judged acceptable because a tag name is public product vocabulary, is capped
  at `MAX_NAME_LENGTH`, and is rendered as escaped text. `AdminActionDetail`'s
  flat-scalar `z.record` is what makes nesting an entity unwritable.
- **Best-effort vs transactional logging is a stated rule, not a mistake.** Only
  the ban and the dispute resolution log best-effort, because both have already
  moved money through Stripe; every other writer rides its own transaction.

**How to apply:** treat a new writer as in scope only for what it puts in
`detail` and which of the two logging modes it picks. The triggers, the cascade
exception and the search_path pinning are closed. See
[[legal-acceptance-record-is-undeletable-pii]] — `legal_acceptances` installs
the same rule via `0029_sad_storm.sql`, and the two share `refusalOf` in
`packages/db/src/testing/test-db.ts`.
