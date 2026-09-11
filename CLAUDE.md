# Vendor Marketplace — project instructions

Two-sided marketplace connecting customers with event vendors. Turborepo + pnpm
monorepo; repo and packages are named `vendor-marketplace`, the product is
**Orla**, read from `BRAND_NAME` and never written as a literal.

## Where things are

| What                     | Where                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticket board (open rows) | `.claude/plans/vendor-marketplace-tickets.md` — read and write only through `node scripts/board.mjs` (`depth`, `list`, `get`, `next`, `set`, `add`)  |
| Closed tickets           | `.claude/plans/vendor-marketplace-tickets-archive.md`                                                                                                |
| Plan · decisions         | `.claude/plans/vendor-marketplace-plan.md` · `.claude/plans/vendor-marketplace-decisions.md`                                                         |
| Design contract          | `design/Orla - Screens.dc.html` (1440×900 frames, the acceptance criterion); `design/design-plan/` explains them                                     |
| Path-scoped rules        | `.claude/rules/` — load automatically when you open a matching file; not duplicated here                                                             |
| Agents                   | `.claude/agents/`: `browser-verifier`, `parity-checker`, `bug-hunter`, `unhappy-path-hunter`; global: `Explore`, `diff-reviewer`, `security-auditor` |
| Auto-memory              | `.claude/memory/` (symlinked from `~/.claude/projects/<slug>/memory`)                                                                                |

There is no Linear project. Do not add one.

## Commands (repo root; turbo fans out per package)

| Task                              | Command                                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verify a change (once, scoped)    | `node ~/.claude/scripts/verify.mjs --lane <id> --ticket <id>`                                                                                                   |
| Lane up / run in / enqueue / down | `pnpm lane:up <id>` · `pnpm lane:exec <id> -- <cmd>` · `pnpm lane:pr <id> <url>` · `pnpm lane:down <id>`                                                        |
| Full suites (what CI runs)        | `pnpm format:check && pnpm typecheck && pnpm lint && pnpm build && pnpm test && pnpm test:contention && pnpm test:agents`                                       |
| Preflight gate for a ticket       | `pnpm preflight --ticket <n>`                                                                                                                                   |
| Dev servers                       | `pnpm dev` — web 3000, API 4000 (lanes get their own ports)                                                                                                     |
| Database                          | `docker compose up -d` (Postgres + MinIO) · `pnpm db:generate` after editing `packages/db/src/schema` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:seed:e2e` |
| Env registry                      | `pnpm env:example` regenerates `.env.example` and `turbo.json` passthrough; never hand-edit them                                                                |
| Secret scan                       | `pnpm secrets:scan` (staged) · `pnpm secrets:scan:all`                                                                                                          |

`pnpm db:seed:e2e` (after `db:seed`) is what makes vendor and admin surfaces
reachable: it gives the E2E vendor a published storefront, a package, a live
booking request and a **real Stripe test-mode connected account**, and seeds the
persistent admin account (the only way `/admin` is reachable; never delete it).
It needs `.env.e2e.local` and a `CLERK_SECRET_KEY` for the same Clerk instance,
refuses production and protected Neon branches, and `lane:up` runs it per lane.
Pin the connected account across lanes with `E2E_VENDOR_STRIPE_ACCOUNT_ID`.

Deployed web: `web-gules-eta-41.vercel.app` — the parity target after every push.

## Layout

```
apps/web            Next.js 15 (App Router, RSC)         apps/api          Fastify 5
packages/shared     Zod schemas, constants, env registry packages/db       Drizzle schema, migrations, seeds
packages/preflight  pnpm preflight + the lane CLI        packages/config   shared TS / ESLint / Tailwind config
design/             the Orla design contract
```

Dependency direction is one-way: `apps -> packages`.

## Laws that apply everywhere

- **Credentials never reach git or Claude configuration.** `.gitignore` covers
  `.env.*`; a pre-commit hook scans staged blobs; CI scans every tracked file.
  A value that fired the scan is rotated, not deleted.
- **Local development and every lane run on the Docker Postgres.** Staging and
  production are Neon branches; never point local work at them.
- **Never commit generated output**: `packages/db/drizzle/`, `.env.example`,
  `turbo.json` passthrough — edit the source and regenerate.
- **A development default must never reach production**: derive it from what the
  platform sets, or throw; assert the production branch in a test.
- **One ticket per worktree.** The commit hook refuses a dirty tree, so two
  sessions in one checkout deadlock. `EnterWorktree` branches from
  `origin/main` and carries no uncommitted work.
- **MVP only.** Nothing from a screen file's Post-MVP section; no invented
  numbers on a public page.
- **Verification is delegated, not asserted.** `browser-verifier` for every
  user-reachable change, `parity-checker` for every screen with a frame, at
  1440×900, all six axes. Whole-app sweep: `/hunt-bugs` (needs the stack up).

## Merging

No merge queue. `main` requires the CI check, an up-to-date branch and linear
history; auto-merge is on. `gh pr merge --squash --auto` then
`~/.claude/scripts/wait-merge.sh <pr>` (it updates a BEHIND branch). Tracker
edits ride on `main` directly, never inside a code PR.

## Stack

Next.js 15 · Fastify 5 · Drizzle · PostgreSQL 18 (Neon; Docker locally) · Clerk ·
Stripe Connect · Cloudflare R2 · Resend · Tailwind 4 + shadcn/ui · Zod · Vitest · Playwright
