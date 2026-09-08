---
name: filter-bar-params-is-a-narrowing-contract
description: FilterBar's `params` prop re-emits admin searchParams as hidden form fields; its type cannot tell a narrowed value from a raw one, so the guarantee lives entirely in each page's params object
metadata:
  type: project
---

`apps/web/src/components/admin/filter-bar.tsx` takes `params?: Record<string,
string | undefined>` and renders one `<input type="hidden" name={key}
value={value}>` per non-empty entry, so `Apply filters` re-sends the filters
instead of submitting a bare path (#455). All seven `/admin/*` surfaces pass it.

**Why:** the prop's type is structurally identical for a narrowed value and for
a raw `searchParams` string. Nothing in the component, and nothing in
`apps/web/src/lib/admin-params.ts`, marks a value as having been through
`oneOf` / `uuidParam` / `boundedText`. As of the #455 review every caller does
pass the narrowed object — the same one it hands its `Pager` — and the values
are a closed vocabulary, a `uuidSchema` parse, or a facet drawn from the
database. React escapes the attribute, so the echo itself is not an injection
sink; the exposure would be re-emitting an unvalidated string into a URL the
server then 400s on, which `.claude/rules/web-route-boundaries.md` calls the
500-for-a-pasteable-URL defect.

**How to apply:** when a new `/admin` surface adds a `FilterBar`, or an
existing one grows a filter, check the object handed to `params` is the parsed
one and not `raw`. Two live couplings to check with it:

- `page` must stay absent from every `params` object. A narrower filter has to
  land on page 1.
- `q` is skipped only when `searchPlaceholder` is truthy — the skip keys on the
  placeholder's presence, not on the search input's `name`. A surface that
  passes `params={{ q }}` without a search field submits `q` as a hidden field;
  one that renders a search field under a different name would submit `?q=a&q=b`.

Related: [[url-params-validated-in-the-nuqs-hook]] (the same "the boundary is
the helper, not the screen" shape on the customer side),
[[client-component-props-are-public-html]] — `FilterBar` is `'use client'`, so
`params` reaches the RSC payload, which is fine here only because every value
was already in the operator's own URL.
