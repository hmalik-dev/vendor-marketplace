# The `app_api` role (VEN-505)

Row-level security binds only a role that neither owns the tables nor carries `BYPASSRLS`. `neondb_owner` has `BYPASSRLS` on `dev` and `staging` (VEN-504), so the API must connect as a separate role. Migration `0061_app_api_role_messages_rls` creates it as `NOLOGIN` with its grants; **giving it a login and switching the API to it are console steps.**

## What ships

- `app_api`: `NOSUPERUSER NOBYPASSRLS`, owns nothing, `SELECT/INSERT/UPDATE/DELETE` on the `public` tables and `USAGE, SELECT` on their sequences (default privileges cover later tables). `UPDATE` on `messages` is limited to `read_at`.
- Every table other than `messages` carries one policy, `app_api_unscoped` (`using (true)`), so switching the role changes nothing there until that table's own ticket replaces it. `row-level-security` and `request-identity.contention` tests fail a table that has no `app_api` policy.
- `messages` is `FORCE`d and has policies for the sender (insert), the counterparty (mark read), a participant (select) and operators (`app.role = 'admin'` **and** `app.operator = 'true'`, which only the console's own read paths set; select only). Identity comes from `withRequestIdentity` (`packages/db/src/request-identity.ts`), which sets `app.user_id` and `app.role` transaction-locally.
- Migration `0077_app_api_reads_migration_count` (VEN-565) grants `USAGE` on schema `drizzle` and `SELECT` on `drizzle.__drizzle_migrations`, and nothing else there. `/ready` counts that table to prove the migrations ran on the database the API actually uses (VEN-519); without the grant every probe under `app_api` answered 503 `permission denied for schema drizzle` and the release's healthcheck failed. `app_api` still cannot `INSERT`, `UPDATE`, `DELETE` or `CREATE` in `drizzle` (`ready.app-api.contention.test.ts`). The grant ships as a migration, never by hand on a branch.
- Migrations and seeds keep the owner role through `DATABASE_URL_UNPOOLED`.

## Console steps (account holder), per Neon branch: `dev`, `staging`, then `production`

1. Apply migration 0061 first (the deploy workflow's migrate step does it; the role does not exist before it).
2. In the Neon SQL editor as the owner, with a generated password held in a password manager:

   ```sql
   ALTER ROLE app_api WITH LOGIN PASSWORD '<generated>';
   ```

3. Build the **pooled** connection string for `app_api` (same host and database as the current `DATABASE_URL`, user `app_api`). Set it as `DATABASE_URL` on the API host (Railway). Leave `DATABASE_URL_UNPOOLED` on the owner.
4. Redeploy the API and check `/ready`.
5. Verify (criterion 5). Expected output `f`:

   ```sql
   select rolbypassrls from pg_roles where rolname = 'app_api';
   ```

6. Prove `/messages` works under the role, unattended, with the committed spec (VEN-562) rather than by hand:

   ```
   STAGING_WEB_URL=https://<staging-web-host> DEPLOY_ENV=local \
     pnpm --filter @vendor-marketplace/web test:e2e:staging
   ```

   It signs up two fresh customer/vendor pairs on staging, publishes each
   vendor's storefront, sends and replies to a message, and asserts both
   inboxes load, a reply is delivered, the two pairs' conversations stay
   isolated, and a signed-out visitor is sent to sign-in. The accounts it
   creates (`orla-stg-…@<mail server>.mailosaur.net`) are left in place —
   nobody edits the database by hand. `apps/web/e2e/staging-messages-rls.staging.spec.ts`
   refuses to run anywhere but a local shell pointed at a host that names
   staging, and never runs in the lane or CI suites. Every assertion message
   on failure names the page and carries the rollback line below; non-2xx
   responses each page received are attached to the run's report.

Rollback, whether the console step above or the spec surfaces the failure: set
`DATABASE_URL` back to the owner's pooled string and redeploy. Nothing in the
schema needs undoing.
