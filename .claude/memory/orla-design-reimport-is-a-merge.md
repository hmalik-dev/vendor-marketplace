---
name: orla-design-reimport-is-a-merge
description: "Re-importing the Orla design is a merge, not an overwrite - and the screens file is now too big for the DesignSync MCP, so it comes from the user's local export"
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-28T02:13:13.695Z
  originSessionId: 455c2c95-480f-458e-b727-7300f60da04e
---

The Claude Design project `18efe924-f9d1-4eed-beb7-ed33b0a545f8`
("Vendor Marketplace UI Mockups") is the source of the Orla design.

**`Orla - Screens.dc.html` can no longer be fetched over MCP.** It passed
256 KiB (303,717 bytes as of 2026-08-27) and `DesignSync.get_file` caps there —
it returns exactly 262,144 bytes with `"truncated": true` and there is **no
offset/range parameter**. `WebFetch` on the design URL 403s and returns markdown
anyway. **The working route is the user's own export**, which they drop in
`~/Downloads/Vendor Marketplace UI Mockups/` — copy that folder into `design/`
with rsync. Verify it by checking the MCP's truncated copy is a byte-prefix of
it. Everything else in the project is still under the cap and fetches fine.

**It is still a merge.** The exported `design-plan/*.md` lag refinements that
shipped tickets already wrote back. On 2026-08-27 the export would have silently
deleted: the past-date rules on search and availability, the vendor-card density
table, the **US-spelling rule that deliberately overrides the frames**, five
colour tokens (`sage-150/200`, `gold-200`, `steel-200`, `error-200`), the
marketing-header degradation table, and the user's own answers to the open
questions. Diff old vs new with formatting normalised (Prettier lowercases CSS
hex, pads tables, uses `_x_` for emphasis) or the noise buries the real changes.

**The parity gate is now IN the design project** — `04-laws.md` came back
byte-identical, so the local-only guardrail has been adopted upstream. It no
longer needs re-adding by hand, but still verify it survived.

**The frame is the tiebreak, and captions lie.** Frame `03`'s caption now
contradicts itself in one sentence. Read the markup. On 2026-08-27 the markup
settled two disputes: "Join as a vendor" appears 0 times against 5 for "Sign up",
and the vendor dashboard really does still render "keep it under 4h to stay
ranked" (so that reverted a decision the user had made to soften it).

**Diff frames by hashing each section with the `sc-d` caption stripped** — that
tells you exactly which screens went out of parity instead of guessing. On the
2026-08-27 import only 5 of 27 changed.

**The source file numbers two different frame sets `25`** (the new 1024 set and
`25 Upload failures`). Every `data-screen-label` is still unique, so reference
frames by full label, never by number. Leave the `.dc.html` byte-identical to
the export rather than renumbering, so the next import stays clean.

See [[vendor-marketplace-orla-design]], [[design-is-a-contract-not-code]],
[[playwright-parity-gate-every-fe-ticket]], [[vendor-marketplace-desktop-first]].
