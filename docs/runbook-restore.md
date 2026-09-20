# Runbook: restoring the database from a Neon snapshot

**Backups are Neon-native only** (ruled by the account holder, 2026-09-19).
Production is protected by scheduled Neon snapshots of the `production` branch
and by the plan's history window. There is no off-platform copy, no encryption
layer and no second provider.

**Accepted, unprotected risk:** loss of the Neon account, or a platform-wide
Neon failure, loses the database and every backup of it. The account holder has
accepted this; it is a stated decision, not an oversight.

Uploaded images are not covered (they live on Neon Object Storage; vendors can
re-upload). Payment records are, which is the point.

A restore that has not been run is a hope. Run the drill (step 2) once before
launch, monthly after that, and after any schema change.

## Tools

`neon api` (the Neon CLI) authenticated as the account holder; the key comes
from `NEON_API_KEY` or `neon auth`, never typed into a command. Project
`dark-surf-79137727`; branch ids from `neon branches list --project-id <p>`.

| Action             | Call                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Read the schedule  | `neon api /projects/<p>/branches/<b>/backup_schedule -o json`                                                                              |
| Set the schedule   | `neon api -X PUT /projects/<p>/branches/<b>/backup_schedule -d '{"schedule":[{"frequency":"daily","hour":3,"retention_seconds":604800}]}'` |
| Snapshot now       | `neon api -X POST /projects/<p>/branches/<b>/snapshot -Q name=<label>`                                                                     |
| List snapshots     | `neon api /projects/<p>/snapshots -o json`                                                                                                 |
| Restore a snapshot | `neon api -X POST /projects/<p>/snapshots/<id>/restore -d '{"name":"scratch-<label>"}'`                                                    |

Schedule entry fields are `frequency`, `hour`, `day`, `month`,
`retention_seconds`. Check the retention the current plan allows before
choosing it; the API rejects what the plan cannot hold.

## 1. Check the schedule

Scheduled snapshots need the paid Neon plan (tracked on VEN-443); until the
upgrade the schedule stays off and only manual snapshots exist.

Read the `production` schedule back. An empty `"schedule": []` means no
backups exist: set it (table above) and read it back again.

## 2. The restore drill

1. Pick a snapshot (`List snapshots`), or take one of `production`. Neon
   refuses snapshots of non-root branches ("not allowed to snapshot non-root
   branch"), so `staging` and `dev` cannot be snapshotted; only `production`
   can.
2. **Restore into a scratch branch, never `production`.** Give the request a
   `name`; do not pass `target_branch_id`, and never `finalize_restore: true`,
   because either could move or overwrite a live branch. If the response does
   not name a new branch, stop and read the operation before doing anything.
3. Get the scratch branch's direct connection string
   (`neon connection-string <scratch> --project-id <p>`) into your env file, not
   the command line.
4. Count `users`, `bookings`, `payments` and `payouts` (the tables behind those
   names are in `packages/db/src/schema`) on the scratch branch and on the
   source as of the snapshot time. They must be equal; a mismatch is a failed
   drill.
5. Delete the scratch branch: `neon branches delete <scratch> --project-id <p>`.

Record the output on the ticket that ran the drill.

## 3. Restoring one table into the live database

The case: a bad `UPDATE` or `DELETE` damaged one table; everything else is fine.
Do not restore over `production`.

1. **Stop writes to the table.** Put the API into maintenance or pause the job
   that writes it; note the time.
2. **Restore a snapshot into a scratch branch** (step 2.1 to 2.3).
3. **Compare** the damaged rows in the scratch branch and in production, and
   decide which rows to put back. Rows written since the snapshot exist only in
   production and must be kept.
4. **Export only those rows** from the scratch branch:

   ```sh
   pg_dump --data-only --table=public.bookings "$SCRATCH_URL" > bookings.sql
   ```

   or, for a subset, `\copy (select * from bookings where id in (…)) to 'rows.csv' csv header`
   in `psql` against the scratch branch.

5. **Load into production inside one transaction**, on the direct endpoint:

   ```sql
   begin;
   create temp table restored (like public.bookings including all);
   \copy restored from 'rows.csv' csv header
   insert into public.bookings select * from restored
     on conflict (id) do update set  -- list the columns to put back
       status = excluded.status, updated_at = excluded.updated_at;
   -- check the counts you expect, then:
   commit;
   ```

   Foreign keys refuse a row whose parent is gone; restore parents first.

6. **Verify** the application reads the rows correctly, then delete the scratch
   branch.
7. **Record** what was restored, from which snapshot, and why in the incident
   note.

Stripe is the source of truth for money movement: after restoring payment or
payout columns, reconcile them against the Stripe dashboard before re-enabling
the payout sweep.
