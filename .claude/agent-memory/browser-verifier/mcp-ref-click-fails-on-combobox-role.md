---
name: mcp-ref-click-fails-on-combobox-role
description: browser_click/browser_type with a pasted snapshot ref on role=combobox inputs throws "Unexpected token" CSS parse errors — pass a plain CSS selector as target instead
metadata:
  type: feedback
---

`mcp__plugin_playwright_playwright__browser_click` (and `browser_type`) reliably
throw `Unexpected token "" while parsing css selector` when `target` is a ref
copied straight from a snapshot line for a `role="combobox"` element (e.g.
`combobox "Vendor type" [ref=f131e34]`). This happened on Orla's search-bar
comboboxes (#375 verification) every time, regardless of which specific ref.

**Why:** unclear root cause inside the MCP tool's ref-to-selector translation,
but it is consistent and unrelated to the app under test — the same page
worked fine when targeted a different way.

**How to apply:** when a `browser_click`/`browser_type` call on a combobox/listbox
element throws this CSS-parse error, don't retry the same ref — switch `target`
to a plain CSS selector (`input[aria-label="Vendor type"]`, `#the-actual-dom-id`,
`[role="option"]:has-text("Photography")`). Get the DOM id via
`browser_evaluate` first if the aria-label alone isn't unique (see
[[search-bar-has-hidden-duplicate-inputs]]). This is faster than repeated retries
and isn't a defect in the app.
