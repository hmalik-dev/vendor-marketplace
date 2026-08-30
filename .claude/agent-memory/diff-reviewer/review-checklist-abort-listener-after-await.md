---
name: review-checklist-abort-listener-after-await
description: When a diff threads an AbortSignal into a transport, check where the abort listener is registered relative to every await before it — a listener added after abort() fired never runs, and a mocked uploader hides it
metadata:
  type: feedback
---

When a diff adds cancellation by threading an `AbortSignal` into an existing
transport helper, do not stop at "the signal reaches the request". Find the
**listener registration line** and count the `await`s that precede it.

`AbortSignal` fires `abort` exactly once, at `abort()` time. A listener added
afterwards never runs. So this shape silently ignores the cancel:

```ts
const token = await getToken(); // <- cancel can land here
const request = new XMLHttpRequest();
signal?.addEventListener('abort', () => request.abort()); // too late
request.send(body); // completes, and gets persisted
```

Verified in `apps/web/src/lib/use-api.ts` (`useImageUpload`) on #173: `await
getToken()` precedes the listener, and there is no `if (signal.aborted)`
pre-check, so a `Cancel` that lands in that window uploads the file anyway and
`onUploaded` writes the row.

**Why:** the caller-side loop in `use-upload-queue.ts` checks
`controller.signal.aborted` _between_ files, which looks airtight — but `send`
then does `await screenDimensions(file)` (a `createImageBitmap` decode, tens of
ms for a 12 MB JPEG) before calling `upload()`, so the whole decode plus the
token fetch is an unguarded window on every file, including the first.

**How to apply:**

- Grep the transport for `addEventListener('abort'` / `signal.aborted`. If the
  only guard is a listener, ask what is awaited above it.
- Ask the same of the _caller_: is `signal.aborted` re-checked immediately
  before the request, or only at the top of the loop iteration?
- **The test mock will not catch this.** These suites `vi.mock('./use-api')`
  with a fake that reads `options.signal?.aborted` when the fake finishes —
  which models abort as always effective, the exact assumption in question. A
  green suite means nothing here. Check whether a test file for the real
  transport exists at all (on #173 there was no `use-api.test.tsx`).
- Repro without the repo: register a listener after an `await`, call `abort()`
  synchronously after invoking the function, and print the outcome.

Related: [[review-checklist-eventsource-reconnect-untested]] — same failure
mode, a lifecycle path the shipped suite never drives.
