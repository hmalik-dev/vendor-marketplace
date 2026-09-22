---
name: no-cookie-consent-claim-rests-on-a-source-scan
description: /cookies and /privacy state as fact what the tree loads and writes; the only guards are one regex list in no-cookie-consent.test.ts and a substring check in legal-content.test.ts, and both under-match
metadata:
  type: project
---

`apps/web/content/legal/cookies.md` and `privacy.md` assert there is no consent
banner because the product sets no cookie of its own and loads no tracker. The
guards are `apps/web/src/app/no-cookie-consent.test.ts` and
`apps/web/src/lib/legal-content.test.ts`, and they are the only things between
those public claims and a regression.

The tracker and consent scans are sound in mechanism — `sourceFiles` strips
comments (`withoutComments`) and skips `.test.` files, so the prose quoting the
forbidden patterns cannot self-match — but **`TRACKERS` is a vendor list**
(`gtag`, `posthog`, `hotjar`, …) and names no first-party-proxied analytics.
**The "writes no cookie of its own" scan** matched `cookies().set`, impossible
under async Next 15; the reachable shapes (`(await cookies()).set`, a
destructured store, `response.cookies.set` in `middleware.ts`) are covered now.
The walk is limited to `apps/web/src`, so `next.config.ts`, `instrumentation.ts`
and any `Set-Cookie` from `apps/api` are outside it.

**VEN-496 put analytics in the tree** — `components/web-analytics.tsx`,
`@vercel/analytics/next`, gated on `VERCEL_ENV === 'production'` (staging is a
Vercel _preview_ alias, so the gate does isolate production) and skipped on
`isAdminRoute`. Same-origin `/_vercel/insights/*`, so CSP needs no new host;
outside production the package would load `va.vercel-scripts.com`, which the
policy correctly refuses.

**VEN-596 (audited PASS) removed the surviving denials** and replaced the single
`'no analytics'` substring with an `ANALYTICS_DENIALS` phrase list; it is still a
phrase list, so a new wording of a denial passes. The new copy claims page views
are "not tied to your account" — that rests on `analytics-scrub.ts`'s
`beforeSend` (admin + id routes dropped/normalised, query stripped); widening
analytics to custom events or user ids falsifies it. The frontmatter `note` is
rendered as a JSX text node from a committed file: no injection path.

**How to apply:** treat every factual claim in `content/legal/` as an assertion
the code owes a guard, and audit the guard rather than the sentence — including
the sentences the diff did **not** touch. See
[[source-grep-guards-match-their-own-comment]].
