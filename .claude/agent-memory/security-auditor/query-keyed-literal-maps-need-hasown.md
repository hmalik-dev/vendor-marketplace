---
name: query-keyed-literal-maps-need-hasown
description: Any `Record<string, …>` literal indexed by a URL query value must be gated by Object.hasOwn (or be a Map); `__proto__`/`constructor` otherwise resolve to prototype members
metadata:
  type: project
---

A plain object literal indexed by attacker-chosen text returns inherited
members: `?x=constructor` gives `Object`, `?x=__proto__` gives
`Object.prototype`. Rendered as a React child the object throws ("Objects are
not valid as a React child") and the page 500s for whoever opens the link; a
function child is dropped or refused at the RSC client boundary.

Seen twice: `/search` retired-category successor (hasOwn present, see
[[search-retired-category-redirect]]) and VEN-703's `/account/settings?saved=`
banner (`SETTINGS_SAVED_COPY[saved]` with only a `typeof === 'string'` check,
reported 2026-09-24).

**Why:** `typeof saved === 'string'` looks like validation but admits every
prototype key; the copy map being "fixed" does not make the lookup closed.

**How to apply:** when a diff adds a lookup keyed by a search param, route
param or body field, require `Object.hasOwn(map, key)`, a `Map`, or a Zod enum
before the index. Severity is Low (crafted link, no injection) unless the
result feeds a redirect, a query or a permission.
