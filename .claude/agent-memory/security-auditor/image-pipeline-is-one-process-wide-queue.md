---
name: image-pipeline-is-one-process-wide-queue
description: VEN-464 put every upload decode behind a 2-slot module-global semaphore with an unbounded FIFO; the queue depth, not the decode, is now the memory ceiling
metadata:
  type: project
---

`processUploadedImage` (`apps/api/src/lib/images.ts`) runs inside
`withImageSlot`: module-global `activeJobs` capped at `MAX_CONCURRENT_IMAGE_JOBS`
(2) with a hand-off FIFO. The hand-off is correct — the finishing job resolves
the next waiter without touching the counter, and the `finally` means no throw
leaks a slot — so do not re-report a slot leak or deadlock.

What is left: `waitingJobs` has **no depth cap and no wait timeout**, and a
waiter holds its whole `MAX_UPLOAD_BYTES` (12 MB) buffer resident the entire
time it waits. Admission is only the rate limits (10 uploads/min/account,
120/min/IP), so a handful of free accounts outrun 2 slots and the backlog — not
the decode — is what exhausts memory. A wedged libvips call takes the endpoint
down permanently with no signal.

`MAX_INPUT_PIXELS` (40 MP) is checked twice: from `metadata()` (header only, no
`limitInputPixels` on purpose, so the specific message survives) and again by
`limitInputPixels` on both decodes. The format allowlist runs before the pixel
check, so only jpeg/png/webp ever reach it (WebP added by VEN-618, audited clean:
sharp 0.35 bundles a post-CVE-2023-4863 libwebp, default `pages: 1` decodes one
frame of an animated file, and 40 MP sits well under WebP's 16383² ceiling).

The earlier `failOn: 'error'` loosening is gone: `SHARP_INPUT_OPTIONS` is
`limitInputPixels` only and keeps sharp's default `'warning'` (checked 2026-09-23).

**Why:** VEN-464 bounded upload memory/pixels after an unbounded-concurrency
decode path.
**How to apply:** treat queue depth as the resource to bound in any later change
here; a new call site of `processUploadedImage` (a background reprocessor, a
webhook) shares these 2 slots process-wide and can starve the interactive route.
Related: [[image-key-columns-are-client-supplied]].
