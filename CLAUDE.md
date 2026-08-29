# Vendor Marketplace — Project Instructions

Two-sided marketplace connecting customers with event service vendors
(photographers, DJs, caterers, florists). Turborepo + pnpm monorepo.

The repo and every package are named `vendor-marketplace`. **The user-facing
product is Orla**, read from `BRAND_NAME` and never written as a literal.

## Where things are

| What                           | Where                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Ticket queue                   | `.claude/plans/vendor-marketplace-tickets.md` — the Status Board table                                                       |
| Plan                           | `.claude/plans/vendor-marketplace-plan.md`                                                                                   |
| Decisions                      | `.claude/plans/vendor-marketplace-decisions.md`                                                                              |
| Design contract                | `design/` — `Orla - Screens.dc.html` holds the 1440x900 frames and is the acceptance criterion; `design-plan/` explains them |
| Path-scoped conventions        | `.claude/rules/` — loaded automatically when you touch matching files                                                        |
| Auto-memory                    | `.claude/memory/` — `~/.claude/projects/<slug>/memory` is a symlink to it, so what a session writes is committable           |
| Review and verification agents | `.claude/agents/` and `~/.claude/agents/`                                                                                    |

## Ticket queue

This project's queue is the **local markdown tracker** above. There is no Linear
project here and no Linear MCP server: one was configured once, never connected,
and was removed on 2026-08-28. Do not re-add it.
`/next-ticket` and `/ticket` read eligibility, priority and `Blocked By` from the
Status Board table and write transitions back to it (Backlog -> In Progress ->
Done), filling the Branch column and recording the commit SHA in Notes.

**Trust the repository over the ticket's prose.** A ticket's "current state"
section goes stale the moment another ticket touches the same files. Verify each
claim before implementing it.

## Commands

Run from the repository root; Turborepo fans each task out across packages.

| Task            | Command                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| Install         | `pnpm install`                                                                               |
| Build all       | `pnpm build` (`--force` when the change touches anything the build _resolves_)               |
| Typecheck all   | `pnpm typecheck`                                                                             |
| Lint all        | `pnpm lint`                                                                                  |
| Test all        | `pnpm test`                                                                                  |
| Format          | `pnpm format` (check with `pnpm format:check`)                                               |
| Preflight gate  | `pnpm preflight --ticket <n>`                                                                |
| Regenerate env  | `pnpm env:example`                                                                           |
| Secret scan     | `pnpm secrets:scan` (staged) · `pnpm secrets:scan:all` (whole tree)                          |
| Dev servers     | `pnpm dev` — web on 3000, API on 4000                                                        |
| Build API image | `docker build -f apps/api/Dockerfile -t vendor-marketplace-api .` (context is the repo root) |
| Single package  | `pnpm --filter @vendor-marketplace/db <script>`                                              |

Database:

| Task                 | Command                                                      |
| -------------------- | ------------------------------------------------------------ |
| Start local services | `docker compose up -d` (Postgres + MinIO; both used locally) |
| Generate a migration | `pnpm db:generate` (after editing `packages/db/src/schema`)  |
| Apply migrations     | `pnpm db:migrate`                                            |
| Seed reference data  | `pnpm db:seed`                                               |
| Browse data          | `pnpm db:studio`                                             |

Deployed web: `web-gules-eta-41.vercel.app` — the parity target after every push.

## Layout

```
apps/
  web/        Next.js 15 (App Router, RSC) frontend      — port 3000
  api/        Fastify 5 backend                          — port 4000
design/       The Orla design contract
packages/
  shared/     Zod schemas, inferred types, constants, utilities, env registry
  db/         Drizzle schema, client, migrations, seed
  preflight/  `pnpm preflight` — the pre-ticket environment gate
  config/     Shared TypeScript, ESLint, and Tailwind configs
```

**Dependency direction is one-way: `apps -> packages`.**

## Laws that apply everywhere

Anything narrower than this lives in `.claude/rules/` and loads when you open a
matching file. Do not duplicate it here.

- **Credentials never reach git.** `.gitignore` covers `.env.*` and re-admits only
  `.env.example`; a pre-commit hook scans staged blobs; CI scans every tracked
  file so `--no-verify` cannot bypass it. The rules, the fixture allowlist and the
  `secret-scan:allow` pragma live in `packages/preflight/src/secrets/`. **If the
  scan fires on a real value, rotate it — deleting it is not enough.**
- **Credentials never reach Claude configuration either.** Not inline in a
  command, not in `.claude/settings*.json`, not in an agent, skill or rule. They
  live in `.env` files and are read from the environment. A `PreToolUse` hook
  blocks both routes.
- **Local development runs on the Docker Postgres; staging and production are
  Neon branches.** Never point local development at `production`. The compose
  image tracks the major version Neon runs, and a drift test enforces it.
- **Never commit generated output.** `packages/db/drizzle/`, `.env.example` and
  `turbo.json`'s `globalPassThroughEnv` are all generated; edit the source and
  regenerate.
- **A development default must never be able to reach production.** Derive it from
  something the platform sets, or throw.
- **MVP only.** No ticket implements anything from a screen file's Post-MVP
  section, and no invented numbers reach a public page.

## Verification is delegated, not asserted

Claiming a change works is not verifying it. Use the agents:

| Agent                 | Use for                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| `diff-reviewer`       | Adversarial read of the finished diff, in fresh context                            |
| `security-auditor`    | Any diff touching auth, input, data access, uploads, redirects, secrets or logging |
| `browser-verifier`    | Every user-reachable change, driven end to end at both auth states                 |
| `parity-checker`      | Every screen carrying an Orla frame, at 1440x900, on all five axes                 |
| `Explore`             | File discovery and symbol tracing, so results stay out of this context             |
| `bug-hunter`          | Read-only defect hunt along one dimension, inside a sweep                          |
| `unhappy-path-hunter` | Driving one flow in the browser trying to break it                                 |

To sweep the whole application rather than one change, run **`/hunt-bugs`** — a
workflow that fans read-only hunters across nine defect dimensions, drives seven
user flows in the browser hunting unhappy paths, and puts every candidate through
three skeptics before reporting it as a ticket. It needs the dev stack up, so run
`/start` first. Pass `{"drive": false}` to skip the browser phase, or
`{"dimensions": [...]}` / `{"flows": [...]}` to narrow it.

Global engineering standards (type safety, defensive code, commit format,
pre-commit gate) live in `~/.claude/CLAUDE.md` and
`~/.claude/references/code-standards.md`.

## Stack

Next.js 15 · Fastify 5 · Drizzle ORM · PostgreSQL 18 (Neon; Docker locally) · Clerk ·
Stripe Connect · Cloudflare R2 · Resend · Tailwind CSS 4 + shadcn/ui · Zod ·
Vitest · Playwright
