---
paths:
  - 'apps/web/src/app/**/*.tsx'
  - 'apps/web/src/lib/*-data.ts'
  - 'apps/web/src/lib/api-client.ts'
---

# The route boundary is untrusted input

`searchParams`, `params` and anything read from the URL are attacker-controlled
strings. A Server Component that formats one without validating it does not throw
a handled error — it returns **HTTP 500** for a URL anyone can paste into Slack.

An adversarial sweep on 2026-08-28 found six of these on `/search` and
`/vendors/[slug]` alone, from `?date=not-a-date`, `?date=2026-13-45`,
`?date=0000-00-00`, an ISO timestamp in a date-only field, an uppercased slug,
and a 300-character slug. Every one of them rendered the 500 page.

## Parse at the boundary, never format raw

Every `searchParams` and `params` value is parsed with the shared Zod schema for
that screen **before** any component formats, compares or queries with it.

- A value that fails the schema is **dropped and the screen renders without it**,
  the way a past date is already handled correctly on `/search` — cleared, with a
  line saying it was cleared. It is never allowed to reach `new Date()`,
  `Intl.*`, `toLocaleDateString` or a query.
- `new Date(x)` on an unvalidated string yields `Invalid Date`, and every
  `Intl` formatter throws `RangeError: Invalid time value` on it. Validate first
  or guard `Number.isNaN(d.getTime())`; never both-and-hope.
- A page's heading must be derived from the **same parsed value** the body used.
  A heading that reads "0 vendors free on Mon, Mar 2" above a body that says the
  request failed means the two read different sources.

## Map upstream status to the right Next.js outcome

A 4xx from the API is a _client_ error and almost never a 500 page.

| Upstream                                                | Route must return                                      |
| ------------------------------------------------------- | ------------------------------------------------------ |
| 404, or a 400 caused by an identifier that cannot exist | `notFound()`                                           |
| 400 from a malformed filter or query value              | render the screen with that filter dropped, and say so |
| 401 / 403                                               | redirect to sign-in, or the suspended surface          |
| 5xx, timeout, network failure                           | the error boundary                                     |

`getPublicVendorProfile` returning a validation error for an unparseable slug is
the 404 case, not the 500 case. Decide this in the data function, not in the page.

## Never render an upstream error string

`40-states.md` requires every error to say what happened in the user's words and
offer one action. `"Request validation failed"` is the API's top-level message and
fails both halves. Map to approved copy from `31-content-voice.md`; log the
upstream detail, do not print it.

## Bound the input in the UI too

Every text input whose value reaches a length-capped API field carries the
matching `maxLength`. A City field with no `maxLength` against a 100-character API
cap turns a long paste into a user-visible error that validation should have
prevented.

## Long values must not break the layout

Any user- or URL-supplied string rendered into a heading gets a truncation or
wrapping rule. A 600-character city name produced a 5386px-wide `h1` in a 1440px
viewport — invisible to a `scrollWidth` assertion because an ancestor clipped it,
and visibly broken on screen.

## The regression test

A fix here is not finished until the route has a test that asserts the
**status code** for the hostile input, not just the happy path:

```ts
// The class of defect: a bad param must not 500.
for (const q of ['?date=not-a-date', '?date=2026-13-45', '?page=0', '?city=' + 'A'.repeat(300)]) {
  const res = await fetch(BASE + '/search' + q);
  expect(res.status).toBe(200);
}
```
