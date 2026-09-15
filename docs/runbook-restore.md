# Runbook: restoring the database from a backup

Every night at 03:00 UTC `.github/workflows/backup.yml` takes a `pg_dump` of
production, encrypts it with `age`, and stores it in the **backups** bucket — a
bucket separate from uploads, reachable only with its own token. This page is
how to get data back out of it.

A restore that has not been run is a hope. Run the drill (step 2) on a schedule
of your own — monthly, and after any change to the schema or this tooling.

## What is stored

```
db/<environment>/YYYY/MM/DD-HHMMSS.dump.age        pg_dump --format=custom, age-encrypted
db/<environment>/YYYY/MM/DD-HHMMSS.manifest.json   row counts per table, sizes, SHA-256
```

- The manifest's counts are read inside the **same snapshot** the dump is taken
  from, so a restore of that dump must reproduce them exactly.
- The time (UTC) is in the key, so a second run on the same day never overwrites
  the first.
- Retention: the last 30 days, plus the earliest backup of each month for 12
  months. The newest backup is never pruned.
- `<environment>` is `production` for the nightly run, `staging` for a manual
  dispatch — each GitHub environment carries its own secrets.

## The key pair

The dump is encrypted to the public key(s) in `.github/backup-age-recipients.txt`.
The secret key is held by the operator **offline** (password manager plus a
paper copy). Without it no backup can be read, including by us.

Generate once (either tool writes the same format):

```sh
age-keygen -o backup.key             # prints "Public key: age1…"
```

Commit only the `age1…` line to `.github/backup-age-recipients.txt`. To rotate,
add the new public key, let one nightly run use both, then remove the old one;
old backups stay readable only with the old secret key, so keep it until they
age out (12 months).

## Secrets the workflow needs

In each GitHub environment (`production`, `staging`). Restrict the `production`
environment to the `main` branch (Settings → Environments → Deployment branches):
otherwise any pushed branch can add a workflow that names it and reads its secrets.

| Secret                        | What                                                                 |
| ----------------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL_UNPOOLED`       | The branch's **direct** endpoint — a pooler cannot hold the snapshot |
| `BACKUP_S3_ENDPOINT`          | `https://<account>.r2.cloudflarestorage.com`                         |
| `BACKUP_S3_BUCKET`            | The backups bucket                                                   |
| `BACKUP_S3_ACCESS_KEY_ID`     | A token scoped to that bucket alone, read/write                      |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Its secret                                                           |

## 1. Take a backup by hand

Actions → **Database backup** → Run workflow → pick the environment. To prove the
size floor fails the run, set `min_bytes` to something larger than the database
(for example `500000000`); the run must go red with
`The dump is … bytes, below the …-byte minimum` and write nothing.

Locally, against a lane database and MinIO:

```sh
BACKUP_ENVIRONMENT=local BACKUP_S3_ENDPOINT=… BACKUP_S3_BUCKET=… \
  BACKUP_S3_ACCESS_KEY_ID=… BACKUP_S3_SECRET_ACCESS_KEY=… \
  BACKUP_AGE_RECIPIENTS_FILE=/path/to/recipients.txt \
  pnpm lane:exec <id> -- pnpm db:backup
```

Read every value from your env file; never type a credential into a command.

## 2. The restore drill

```sh
pnpm db:restore-drill            # restores, compares, drops the copy
pnpm db:restore-drill --keep     # leaves the restored database in place
```

Environment:

| Variable               | What                                                                             |
| ---------------------- | -------------------------------------------------------------------------------- |
| `BACKUP_ENVIRONMENT`   | Whose backup: `production` or `staging`                                          |
| `BACKUP_AGE_IDENTITY`  | The `AGE-SECRET-KEY-1…` line — load it from the offline copy for this shell only |
| `BACKUP_S3_*`          | As above; a read-only token is enough                                            |
| `RESTORE_DATABASE_URL` | The server to restore **onto**. Defaults to `DATABASE_URL` (the Docker Postgres) |
| `RESTORE_NEON_BRANCH`  | Required when the target is Neon: the scratch branch's name                      |

What it does: downloads the newest manifest (ignoring any dated in the future),
checks that it names the dump beside it and the environment asked for, downloads
that dump, checks the SHA-256,
decrypts, creates a **new** database `restore_drill_<timestamp>_<hex>` on the
target server, runs `pg_restore` into it, counts every table, and prints the
counts beside the manifest's. Exit 0 means every table matches. Without
`pg_restore` installed it borrows the one inside the compose Postgres container,
which only works for a local target.

It refuses — before downloading anything — when `NODE_ENV=production`, when the
target's host or database is named `prod`/`production`, when a Neon target has
no `RESTORE_NEON_BRANCH`, and when that branch is `production`, `main` or
`master`. It never writes into an existing database.

A drill onto Neon: create a scratch branch in the console, set
`RESTORE_DATABASE_URL` to its direct endpoint and `RESTORE_NEON_BRANCH` to its
name, run the drill, delete the branch.

## 3. Restoring one table into the live database

The case: a bad `UPDATE` or `DELETE` damaged one table; everything else is fine.
Do not restore the whole database over production.

1. **Stop writes to the table.** Put the API into maintenance or pause the
   job that writes it; note the time.
2. **Restore a copy** from the last good night:
   `pnpm db:restore-drill --keep` onto the Docker Postgres. Note the database
   name it prints.
3. **Compare** the damaged rows. In the restored copy and in production, query
   the affected ids and decide which rows to put back — rows written since the
   backup exist only in production and must be kept.
4. **Export only those rows** from the copy, as data:

   ```sh
   pg_dump --data-only --table=public.bookings \
     --dbname=restore_drill_… > bookings.sql       # whole table
   ```

   or, for a subset, `\copy (select * from bookings where id in (…)) to 'rows.csv' csv header`
   in `psql` against the copy.

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

   Foreign keys will refuse a row whose parent is gone; restore parents first.

6. **Verify** the application reads the rows correctly, then drop the copy:
   `drop database "restore_drill_…" with (force);`
7. **Record** what was restored, from which backup, and why in the incident
   note.

Stripe is the source of truth for money movement: after restoring
`bookings` payment or payout columns, reconcile them against the Stripe
dashboard before re-enabling the payout sweep.
