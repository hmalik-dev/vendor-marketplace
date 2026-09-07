---
name: a-lane-web-build-must-be-made-under-the-lane-env
description: A lane's web app reads API_URL server-side and inlines NEXT_PUBLIC_API_URL at build time — both must come from .env.lane or the lane renders against another checkout's API
metadata:
  type: project
---

A lane's web app reaches the API by **two different variables**, and getting
either wrong points the whole lane at port 4000:

- `API_URL` — read at request time by `apps/web/src/lib/api-client.ts` for every
  **Server Component** fetch.
- `NEXT_PUBLIC_API_URL` — **inlined into the bundle at build time**, and the
  value the CSP's `connect-src` is derived from.

`renderLaneEnv` wrote only the public one until 2026-09-07, so the root `.env`'s
`API_URL=http://localhost:4000` won for every server-side read. Lane 432's
`/admin/*` routes all rendered the 500 page — `admin/layout.tsx` awaits an admin
read before any child renders, and :4000 answered 500 for a token minted against
this lane. Five UI acceptance items were unverifiable, and the cause read as a
defect in the change under test. `env.ts` writes `API_URL` now, and
`env.test.ts` pins it equal to `NEXT_PUBLIC_API_URL`.

**The build half has no test and cannot get one**, so it is the part to
remember: `pnpm build` run *outside* `lane:exec` bakes `localhost:4000` into the
bundle and into the CSP, and every client-side call is then blocked by CSP or
CORS however correct the server env is. Build through the lane:

```
pnpm lane:exec <n> -- pnpm --filter @vendor-marketplace/web build
```

The tell is one `curl` and worth doing before any browser pass that runs against
a build rather than `next dev`:

```
curl -sI http://localhost:<web port>/ | grep -o "connect-src [^;]*"
```

If that names a port other than the lane's API, the `.next` is stale — rebuild
it, do not debug the page. A second tell is a public page: a lane whose
server-side reads go elsewhere renders `/vendors/<seeded slug>` as **404**,
because the seeded vendor exists only in the lane database.

Any lane whose `.env.lane` predates 2026-09-07 lacks `API_URL` entirely —
`lane:down` and `lane:up` regenerates it. See
[[next-dev-hits-emfile-with-many-lanes]] for why a build is being served at all.
