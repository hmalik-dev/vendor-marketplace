---
name: clerk-localization-is-scoped-by-route-only
description: A nested ClerkProvider silently drops every prop, so route-aware localization on the single root provider is the only way to scope a Clerk string
metadata:
  type: project
---

Clerk keys some strings **globally** — `formButtonPrimary` is one, and it is the
sign-up submit button frame `12` specifies as `Create my account`. There is no
`signUp.start` variant, and `<SignUp />` takes no `localization` prop.

**Nesting a second `ClerkProvider` around the component does not scope it.** It
is a silent no-op, not a partial fix: `@clerk/nextjs`'s client provider opens
`if (Boolean(useClerkNextOptions())) return children`, so an inner provider
renders its children and drops every prop on the floor. Nothing warns.

The only lever is the **route**: make the single root provider a Client
Component and pick the localization object from `usePathname()`. That is
`apps/web/src/components/auth/clerk-shell.tsx`, added by #313 on 2026-09-05.

**Why:** #313 sat blocked for a week with this recorded as "an auth-stability
decision", because the nested provider was assumed to work and the alternative
looked like moving the app's whole auth boundary. It is not: `auth()` is
`server-only` and reads middleware-stamped headers, and `<ClerkProvider dynamic>`
was never passed, so no SSR auth state travels through the provider at all.
Confirmed by `security-auditor` and by driving all three roles in a browser.

**How to apply:** to scope any Clerk string, add it to a second localization
object and branch on the pathname in `ClerkShell` — never by nesting a provider,
and never by putting a global key in `CLERK_COPY`, which would relabel every
flow. Check whether the key is global first: `@clerk/localizations`'s `en-US` is
the authority, and a top-level key with no flow-scoped variant is global.
Related: [[vendor-marketplace-orla-design]], [[design-is-a-contract-not-code]].
