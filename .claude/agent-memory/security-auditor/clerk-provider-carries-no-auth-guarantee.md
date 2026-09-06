---
name: clerk-provider-carries-no-auth-guarantee
description: ClerkProvider's placement (server layout vs 'use client' shell) decides no authorization here — middleware + server auth() + the local users.role column do; verified against @clerk/nextjs 7.8.2 internals
metadata:
  type: project
---

Moving `ClerkProvider` into a `'use client'` component (`ClerkShell`, #313) weakens
no auth guarantee, and the reasoning is worth keeping because it required reading
`@clerk/nextjs` internals.

**Why:** the SDK resolves `ClerkProvider` through the `#components` imports map in
`dist/esm/package.json` — `react-server` gets `app-router/server/ClerkProvider`,
everything else `client-boundary/ClerkProvider` → `ClientClerkProvider`. The server
variant adds exactly three things over the client one:

1. `initialState`, and only `dynamic ? getDynamicClerkState() : undefined` — this
   app never passed `dynamic`, so SSR auth state was already absent.
2. dev-only keyless mode (`canUseKeyless` = development && !automated), which
   auto-provisions an instance when no publishable key is set. Losing it is
   fail-closed: the client provider throws instead of inventing keys.
3. nothing that reads request headers, so the provider was never what made a
   route dynamic. Route dynamism is borrowed from `SiteHeader`'s `auth()` —
   see [[identity-read-is-cached-and-route-dynamism-is-inherited]].

`auth()` is `require("server-only")` and reads headers stamped by
`clerkMiddleware`; it never consults the provider. Protection is per-resource
(`requireRole` in the `/customer`, `/vendor`, `/admin` layouts), which
`apps/web/src/middleware.ts` documents as deliberate.

**Secrets:** `mergeNextClerkPropsWithEnv` reads only `NEXT_PUBLIC_*`. Nothing
instance-identifying is newly serialised — the publishable key moves from an
RSC-payload prop to a build-time inlined literal, which is _less_ exposure but
makes `assertWebEnv()` in `apps/web/next.config.ts` the only thing standing
between a deploy and a bundle carrying an undefined or localhost-default key.
That check now has no server-side runtime fallback behind it.

**How to apply:** do not re-report a Clerk provider move as an auth regression.
Do re-check `assertWebEnv` if anyone loosens the web env gate, and do re-check
`telemetry={false}` on the single provider (CSP, #396) whenever the shell moves —
`ClerkShell` is now the only `ClerkProvider` in the tree, and nothing asserts the
root layout still renders it.
