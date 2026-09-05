---
name: contention-harness-issues-server-ddl
description: createPostgresTestDatabase is the first assertSafeTarget caller that issues CREATE/DROP DATABASE rather than inserting rows; reviewed and accepted at #399 because the dropped name is a fresh UUID
metadata:
  type: project
---

`packages/db/src/testing/postgres-test-db.ts` (#399) creates and drops a
throwaway database on whatever server `DATABASE_URL` names, so the accept-race
suites get two real connections. It is the first `assertSafeTarget` caller
outside `packages/db/src/scripts/`, and the first that issues **server-level
DDL** instead of inserting fabricated rows.

Reviewed 2026-09-04 and **accepted as non-blocking**, so do not re-file it:

- The identifier is `contention_test_` + a hyphen-stripped `randomUUID()` — hex
  only, double-quoted, no interpolation of anything a caller supplies. The
  `drop database if exists ... with (force)` therefore can only name a database
  this call just created; existing data on a mis-pointed server is untouched.
- Migrations and `seedReferenceData` run on the new database, never on the one
  `DATABASE_URL` names. The admin pool (`max: 1`) is the only thing that touches
  it, and only to issue the two DDL statements.
- The residual — `assertSafeTarget` passing unconditionally for any non-Neon
  host, and trusting a declared branch on Neon — is the already-accepted limit
  in [[fabricating-seeds-share-one-declared-branch-guard]]. Ceiling here is an
  orphan database plus compute on a real server, not data loss.

Two things that would change the verdict, so check them on any later diff here:
a name built from anything but `randomUUID`, or a `drop`/`truncate` that names
the database `DATABASE_URL` points at rather than the throwaway.

**How to apply:** if a future change makes this run somewhere unattended — a
deploy hook, a lane bootstrap, a `postinstall` — the bounded-blast-radius
argument no longer carries it, and the target needs a loopback-host restriction
rather than `assertSafeTarget` alone.

The CI Postgres service added alongside it uses `POSTGRES_HOST_AUTH_METHOD:
trust` with no password. Also reviewed and accepted: GitHub-hosted runners are
ephemeral and firewalled inbound, the container holds only throwaway databases,
and CI triggers are `push`/`pull_request` (not `pull_request_target`), so fork
code that could reach it already runs on the same box with no secrets. Adopting
a self-hosted runner would invalidate this.
