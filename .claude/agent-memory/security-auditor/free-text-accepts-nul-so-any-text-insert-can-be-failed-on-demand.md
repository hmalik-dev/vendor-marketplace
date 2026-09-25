---
name: free-text-accepts-nul-so-any-text-insert-can-be-failed-on-demand
description: freeText() now refuses NUL/C0/C1 (REFUSED_TEXT_CHARACTERS); any string that bypasses it still lets a caller fail a statement on demand with Postgres 22021, and a .max() over the column width does the same with 22001
metadata:
  type: project
---

**Fixed in `freeText()`:** it now strips bidi, NFC-normalises, trims, then
refuses `REFUSED_TEXT_CHARACTERS` (`packages/shared/src/utils/index.ts`, covers
`\u0000`-`\u0008`, C1, U+2028/9, zero-width). VEN-689 (2026-09-24) moved the
public `/vendors` and `/vendors/availability/nearby` `city`/`state` query params
onto it, so a pasted `?city=%00` is a 400, not a 22021 500. Audited clean.

**The weapon survives anywhere a bare `z.string()` binds to SQL:** Postgres
refuses NUL in a text parameter (`22021 invalid byte sequence ... 0x00`), so the
caller decides when that statement fails. Any consequence parked on a write's
failure branch (`{ err }` logging, `bestEffort`, `onConflictDoNothing` swallowing
one statement while the rest commits) is then attacker-triggerable.

**22001 is the same weapon (VEN-544):** a schema `.max()` above its column's
`varchar(n)` lets the caller pick a length that fails the insert. Check the
column width, not a neighbouring constant, whenever a length constant moves.

**VEN-616 (2026-09-24) repeated it:** the site-wide notice's
`platformNoticeMessageSchema` was hand-written `z.string().trim()…regex(/^[^<>]*$/)`,
so bidi overrides / ZWSP-only text reached every visitor's banner. A `<>` regex is
not a free-text boundary; build on `freeText()` and chain the regex after it.

**How to apply:** for a new text column or query param, confirm it goes through
`freeText()`/`trimmedString`; if not, ask what happens when that one statement
fails while everything around it succeeds. Do not assume the ordering that saves
one path (e.g. `placeDisputeHold` failing first on `POST /support/messages`)
saves the next. Related: [[support-report-is-a-public-route-that-moves-money]].
