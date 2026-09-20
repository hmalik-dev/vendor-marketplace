# Runbook: undoing a bad deploy

`.github/workflows/deploy.yml` never rolls back on its own. A failed readiness
poll stops the release and says so, and a person decides whether to **revert** or
**fix forward**. The deploy is inert until VEN-377 provisions its inputs, so this
applies from the first real release.

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

Vercel keeps every production deployment. Roll back to the previous one:

```bash
vercel rollback                        # the previous production deployment
vercel rollback <deployment-url>       # a specific one; or Dashboard > Deployments > Instant Rollback
```

A rollback is instant and does not rebuild. It also turns off Vercel's
auto-assignment of new production deployments to the domain, so once the fix has
landed, promote it explicitly (`vercel promote <deployment-url>`) or the domain
stays on the rolled-back build.

## 2. API (the host chosen by `API_HOST`)

The API is a Docker image (`apps/api/Dockerfile`). Redeploy the **previous
image**, not a rebuild of the previous commit:

- Railway: Dashboard > the API service > Deployments > the last good one >
  **Redeploy**.
- Set `SENTRY_RELEASE` back to that deployment's commit first
  (`railway variables --service <service> --set SENTRY_RELEASE=<sha>
--skip-deploys`), or errors from the old code are filed under the bad release.

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

## Do not scale by adding replicas

Rolling back is not a reason to add a second API replica, and neither is load.
The API keeps stream tickets, rate-limit counters and the payout and expiry
overlap guards in process memory, and `railway.json` pins `numReplicas: 1`. See
"Deploy constraints" in `pre-launch.md`.

A rollback or a release is itself a **rolling deploy**: the old and the new
container run side by side until the old one stops, so for that window two
processes exist regardless. Expect a few live streams to drop and reconnect, and
do not read that as the rollback failing.
