# Runbook: undoing a bad deploy

`.github/workflows/deploy.yml` never rolls back on its own. A failed readiness
poll stops the release and says so, and a person decides whether to **revert** or
**fix forward**. A push to `staging` or `production` with an input unset fails at
preflight, before anything moves, so this applies to a release that started.

Where to go from here: a release that **failed partway** is step 5; **redeploying
the same commit** after fixing a provider variable is step 4; **going back** to
an earlier build is steps 1 and 2.

## 0. Decide: roll back or fix forward

- **Roll back** when users are hurt now and the cause is not obvious: a 5xx
  spike in Sentry (tagged by `release`, which is the commit), `/ready` not naming
  the expected commit, or money moving wrongly.
- **Fix forward** when the fix is small and certain, or when a migration in the
  release has already run and the previous code cannot work against it.
- **Never** roll the code back across a migration that is not
  backwards-compatible with it. Check step 3 first.

`/ready` names the commit being served, so after any step below read it back and
confirm it is the one you meant.

## 1. Web (Vercel)

The two tiers are deployed differently, so they roll back differently.

### Production

Production is a production deployment, and Vercel keeps every one. Roll back to
the previous one:

```bash
vercel rollback                        # the previous production deployment
vercel rollback <deployment-url>       # a specific one; or Dashboard > Deployments > Instant Rollback
```

A rollback is instant and does not rebuild. It also **turns off Vercel's
auto-assignment** of new production deployments to the domain. The release
promotes the deployment it just made (`vercel promote <deployment-url>`, in
`web-deploy`), so the next release moves the domain again and re-enables
auto-assignment by itself. To move it back **before** a release, do the same by
hand:

```bash
vercel promote <deployment-url>        # the fixed deployment; the domain follows it
```

### Staging

Staging is **not** a production deployment: it is a preview deployment aliased
to `WEB_URL`'s host, so `vercel rollback` does not apply. Point the alias at the
previous deployment instead:

```bash
vercel ls --environment=preview                          # the deployments, newest first
vercel alias set <previous-deployment-url> <staging-host>   # <staging-host> is WEB_URL's first host, no scheme
```

The alias moves instantly and nothing rebuilds. To undo it, run the same
command with the newer deployment's URL. The next release aliases its own
deployment, so there is nothing to re-enable.

## 2. API (the host chosen by `API_HOST`)

The API is a Docker image (`apps/api/Dockerfile`). Redeploy the **previous
image**, not a rebuild of the previous commit:

- Railway: Dashboard > the API service > Deployments > the last good one >
  **Redeploy**.
- `/ready` names the commit **baked into the image** (`RELEASE_COMMIT`, written
  at build time), so the redeployed image reports its own commit with no
  variable to reset, and a release whose `railway up` failed keeps naming the
  code that is actually running.
- `SENTRY_RELEASE` is now only what the error tracker files events under. Set it
  back to that deployment's commit (`railway variables --service <service> --set
SENTRY_RELEASE=<sha> --skip-deploys`), or errors from the old code are filed
  under the bad release.
- A **rebuild** (`railway up` by hand, or Dashboard > Rebuild) bakes the
  `RELEASE_COMMIT` variable's current value, so set it to the commit being built
  first. A redeploy of an existing image does not rebuild, so it does not matter
  there.

Another host is an entry in `scripts/deploy.mjs`; the step is the same: redeploy
the image that last passed `/ready`.

## 3. Migrations stay backwards-compatible

Migrations run as a release step **before** the new API and web start, so they
always run against the previous release's code. Every migration must therefore
work with the code still serving: additive columns and tables, never a rename or
drop in the same release that stops using the old shape.

That is what makes step 1 and step 2 safe: the previous code runs against the
new schema. **Do not** write a down migration to roll back. If a release's
migration is destructive and has run, fix forward; restore from a snapshot only
as a last resort (`runbook-restore.md`).

## 4. Redeploy the same commit

After fixing a Vercel or Railway variable (or anything else outside the code),
the environment's tip needs to be released again without a new commit:

1. Get the tip: `git ls-remote origin refs/heads/<environment>`. That full sha
   is the only one accepted.
2. GitHub > Actions > **Deploy** > **Run workflow**: choose the `environment`
   (`staging` or `production`) and paste the `sha`.
   (`gh workflow run deploy.yml -f environment=<environment> -f sha=<sha>`.)
3. It runs the whole release for that commit: preflight, web build, migrate (a
   no-op when the schema is current), API, web, then the readiness poll.

The run **refuses** a `sha` that is not the branch's tip, and a commit whose CI
push run did not conclude `success`, so a manual run can only redeploy what the
branch already says. A `sha` that is no longer the tip fails the run; it is not
skipped.

It runs that commit's own `scripts/deploy.mjs`. A tip that predates this
support answers `CI ran for "workflow_dispatch", not a push`; until the tip
includes it, use `gh run rerun <run-id>` on that commit's last Deploy run.

## 5. A release that stopped after the API

The release builds the web first, migrates, ships the API, then deploys the web.
If the web deploy fails once the API is live, the run fails with a line like:

> The API is already live on `<new>` but the web still serves `<old>`: the tiers
> are on different commits.

The API is on the new commit and the web is on the old one. That is safe only
while the API's responses still work for the old web, so do not leave it:

- **Fix forward (preferred).** Find the cause in the run's `web-deploy` log
  (`vercel deploy`, the alias, the deployment URL, or the runtime-variable check),
  fix it, then redeploy the same commit (step 4).
- **Go back.** If it cannot be fixed quickly, redeploy the API's previous image
  (step 2) so both tiers are on the old commit. Check step 3 first: the
  migration has already run.

`/ready` on both tiers should name the same commit before the incident is over.

## Rollback drill

Staging's alias rollback (step 1, Staging) has to be exercised once: alias to the
previous deployment, read `/api/ready`, alias back, read it again. The drill is
the rollback line of the launch rehearsal (VEN-511); paste its dates and command
output here when it runs.

- Not yet run.

## `/ready` says `database: "behind"`

`GET /ready` answers `503` with `"database": "behind"` when the database has
**fewer** migrations applied than the build serving the request ships (the count
of `drizzle.__drizzle_migrations` rows against the entries in
`packages/db/drizzle/meta/_journal.json`). The database is reachable; the
release landed before its migration ran, so any route touching a missing table
or column would fail. The deploy workflow's `/ready` wait fails on it too.

- **Run the migration**, then read `/ready` again: `pnpm db:migrate` with
  `DATABASE_URL_UNPOOLED` set to that environment's database (the deploy
  workflow's migrate step does the same). Do not restart or roll back the API
  for this state, since neither changes the database.
- If migrating is not possible, redeploy the previous image (step 2): an
  older build ships fewer migrations and reads as ready.
- A database **ahead** of the build (a rollback onto older code) stays `ready`
  on purpose, so rolling back across additive migrations keeps serving.
- The check compares **counts**, so it catches a missing migration, not a
  database whose history differs from the build's at the same count (a snapshot
  restored from another branch). Deploys come from one branch, so that is not
  reachable through the release path.
- `database: "down"` is a different failure: the database did not answer, or
  has no migration table at all (a brand-new database also reads `down`; migrate
  it first). Check the API log for the driver's error.

## Do not scale by adding replicas

Rolling back is not a reason to add a second API replica, and neither is load.
The API keeps rate-limit counters and the payout and expiry overlap guards in
process memory, and `railway.json` pins `numReplicas: 1`. See
"Deploy constraints" in `pre-launch.md`.

A rollback or a release is itself a **rolling deploy**: the old and the new
container run side by side until the old one stops, so for that window two
processes exist regardless. Expect a few live streams to drop and reconnect, and
do not read that as the rollback failing.
