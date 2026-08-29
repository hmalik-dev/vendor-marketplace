---
name: clerk-redirect-url-param-collision
description: Naming an app's own return-path query param `redirect_url` hands control to Clerk, which prefers the raw URL param over the fallbackRedirectUrl prop and skips /after-sign-in entirely
metadata:
  type: project
---

`redirect_url` is Clerk's **reserved** query parameter, not a free name. An app
that carries its own post-sign-in destination under that key loses control of the
redirect to clerk-js.

Confirmed in this repo's own `node_modules`
(`@clerk/shared/dist/internal/clerk-js/redirectUrls.mjs`, `#getRedirectUrl`):

```
result  = fromSearchParams[forceKey] || fromProps[forceKey] || fromOptions[forceKey];
result ||= fromSearchParams.redirectUrl;                 // raw ?redirect_url= from window.location
result ||= fromSearchParams[fallbackKey] || fromProps[fallbackKey] || fromOptions[fallbackKey];
```

The raw search param outranks the `fallbackRedirectUrl` **prop**. It is also in
`PRESERVED_QUERYSTRING_PARAMS`, so Clerk carries it across its own navigations.

**Why:** ticket #116 validated the destination in `sign-in/[[...sign-in]]/page.tsx`
with `safeReturnPath` and fed it to `fallbackRedirectUrl`, intending
`/after-sign-in` to re-validate and do role routing. Because the key was
`redirect_url`, clerk-js consumed the raw param first: the server-side validator
gated nothing, `/after-sign-in` was skipped, and with it `POST_SIGN_IN_PATH_BY_ROLE`,
the `/suspended` branch and the loop-prevention list. The only thing still blocking
`https://evil.test` was Clerk's `isAllowedRedirect`.

**How to apply:** on any diff touching the sign-in round trip, check the param name
first. Use an app-owned key (`returnTo`) so `fallbackRedirectUrl` stays load-bearing.
Also note `allowedRedirectOrigins` is **not** set on `ClerkProvider` in
`apps/web/src/app/layout.tsx`, so Clerk falls back to
`createAllowedRedirectOrigins` = own origin + `https://<frontendApi minus "clerk.">`

- `https://*.<same>` — a production custom domain `clerk.orla.com` therefore allows
  every `*.orla.com` subdomain as a redirect target. And `isAllowedRedirect` opens
  with `if (!allowedRedirectOrigins) return true;` — allow-everything if it is ever
  undefined. Setting it explicitly to `[siteOrigin]` closes both.

Related: [[validate-before-normalize-return-path]]
