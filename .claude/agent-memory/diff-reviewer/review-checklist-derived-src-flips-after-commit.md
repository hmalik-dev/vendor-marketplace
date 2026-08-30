---
name: review-checklist-derived-src-flips-after-commit
description: Review checklist — when a diff replaces a cached value with a derived one ("derive, don't cache"), check what the rendered value becomes at the instant of the commit, and whether the deriving input is actually validated at build
metadata:
  type: feedback
---

When a diff shows a value from source A while work is in flight and then commits,
after which the same slot is **derived** from source B (`pending?.url ?? resolve(value)`),
the reviewer's question is: _are A and B the same string, and what enforces that?_
The swap happens at the exact moment the success toast fires, so any divergence
turns "success" into a blank or broken slot.

**Why:** #171 fixed ImageUpload to preview `pending.imageUrl` (from the API's
`S3_PUBLIC_URL`) and, on the img's `load`, commit the key and re-derive the src via
`toImageSrc` (from `NEXT_PUBLIC_S3_PUBLIC_URL`). Two independent env vars, and the
web build validates neither: the registry files it under capability `storage`,
which is outside `WEB_CAPABILITIES = ['core','auth']` in `apps/web/src/config/env.ts`,
so both `assertWebEnv` and the `env.test.ts` browser-key drift gate skip it.
Unset -> the `<img>` unmounts the instant the toast says "updated". Mismatched ->
the src swaps to a second URL, and the `if (!pending) return` guard in the error
handler swallows that URL 404ing.

**How to apply:** Two cheap repros in a scratch `*.test.tsx` inside `apps/web`
(vitest needs the `@/` alias, so it cannot live in /tmp — write, run, delete):
`vi.stubEnv(BASE, '')` and `vi.stubEnv(BASE, 'https://other.test')`, then upload,
`fireEvent.load`, and assert what the img is afterwards. Also trace the deriving
env var back to `registrySchemaShape({ consumer, capabilities })` — a capability
missing from the app's list means nothing asserts the var at build time.
Related: [[review-checklist-unpinned-safety-constants]] — same family, the layer
that is supposed to pin a value does not cover it.
