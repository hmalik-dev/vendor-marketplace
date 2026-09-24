---
name: next-fetch-cache-key-includes-headers
description: Next 15's Data Cache key hashes the fetch's request headers (only traceparent/tracestate are stripped), so a per-call header on a `revalidate` read defeats the cache
metadata:
  type: project
---

Next 15.5's `IncrementalCache.generateCacheKey` puts the request headers into the cache string; only `traceparent`/`tracestate` are deleted first. A header that changes per call (a random `x-request-id`, a visitor IP) on an `apiRequest` with `revalidate` makes every call a miss and a fresh cache write.

**Why:** VEN-690 (2026-09-24) minted a UUID `x-request-id` on every server-side call, including `referenceCaching` reads (`getCategories` etc.), so the anonymous reference-data cache stopped shielding the API and grew one entry per page view. `visitorHeaders` already avoids this by running only when `revalidate === undefined`.

**How to apply:** any new outbound header in `apps/web/src/lib/api-client.ts` must be gated on `revalidate === undefined` unless it is constant across visitors. node_modules is read-denied to this agent; the evidence was a grep hit on `incremental-cache/index.js` (lines ~282-302).
