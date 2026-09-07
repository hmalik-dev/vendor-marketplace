---
name: review-checklist-plpgsql-trigger-without-search-path
description: A DB-enforced immutability trigger whose discriminator reads an unqualified table is defeated by a shadow schema; also TRUNCATE never fires row triggers
metadata:
  type: feedback
---

When a migration installs a plpgsql trigger as the _enforcement_ of an invariant
("application code cannot carry this rule"), three holes are usually present and
the migration's own comment will claim none of them exists:

1. **No `SET search_path` on the function, and unqualified table names in the
   body.** A plain `CREATE FUNCTION` is `SECURITY INVOKER` and resolves
   unqualified names with the _caller's_ `search_path`. Any role that can
   `CREATE SCHEMA` — which the app's own owning role can, on Neon and on the
   Docker Postgres — plants an empty shadow table and the discriminator flips:
   `CREATE SCHEMA evil; CREATE TABLE evil.users (id uuid);
SET search_path = evil, public; DELETE FROM public.legal_acceptances;`
   Every row leaves while every parent survives. Fix: `SET search_path =
pg_catalog, public` on the function, or qualify every name as `public.x`.
   Note a JOIN in the discriminator makes it _easier_ — shadowing either table
   is enough.
2. **`TRUNCATE` does not fire `BEFORE DELETE ... FOR EACH ROW`.** An append-only
   table needs a `BEFORE TRUNCATE ... FOR EACH STATEMENT` trigger too.
3. **A discriminator branch keyed on a secondary FK.** "Parent absent means this
   is a legitimate cascade" is only true of the FK that owns the row. A second
   `OR the acceptor's user row is gone` branch lets that user's deletion strip a
   still-trading vendor's record.

**Why:** #427's `legal_acceptances` shipped all three. The shipped test
(`packages/db/src/legal-acceptance-immutability.test.ts`) attempts a direct
DELETE, a direct UPDATE and the legitimate cascade — all pass, and none of them
touches any hole. The lane fixed 2 and 3 mid-review; 1 survived because nothing
in the suite models a caller with its own `search_path`.

**How to apply:** reproduce, do not reason. A ~50-line PGlite script outside the
repo (PGlite resolves from `packages/db/node_modules/@electric-sql/pglite`)
recreates the parent tables, the FKs and the trigger in seconds; then run the
shadow-schema DELETE, the TRUNCATE, and a delete of each parent in turn. See
[[review-checklist-onconflict-target-vs-other-unique-indexes]] for the same
"the DDL says X, prove it against the engine" discipline.
