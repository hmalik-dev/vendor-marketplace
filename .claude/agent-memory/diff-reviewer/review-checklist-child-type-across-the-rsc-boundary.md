---
name: review-checklist-child-type-across-the-rsc-boundary
description: A 'use client' component that inspects its children with `child.type === SomeClientComponent` fails when a Server Component page passes those children; jsdom render tests cannot see it
metadata:
  type: feedback
---

A client component that walks `Children.toArray(children)` and matches `child.type === FilterSelect`
works in every jsdom render test and fails in the app when the children come from a Server
Component page. React Flight serializes a client reference in element-type position as `$L<id>`
(`serializeClientReference`: `parent[0] === REACT_ELEMENT_TYPE && '1' === parentPropertyName`),
and the Flight client turns `$L` into `createLazyChunkWrapper(...)`, so `child.type` is a
`react.lazy` object, never the imported function. Unkeyed fragments are flattened to arrays.
Props survive, so props duck-typing works; type identity does not.

**Why:** VEN-743's FilterBar derived chip labels from its `FilterSelect` children this way; the
render tests imported FilterBar directly and the e2e asserted only the search chip (derived from a
prop), so every select chip's fallback label (raw key/value) was untested.

**How to apply:** any new `child.type ===` / `displayName` check in a `'use client'` file — list the
server pages that render it, and ask for an e2e (or RSC render) assertion on the derived output.
