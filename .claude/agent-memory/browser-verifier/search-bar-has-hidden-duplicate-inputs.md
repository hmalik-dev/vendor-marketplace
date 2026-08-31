---
name: search-bar-has-hidden-duplicate-inputs
description: Orla's Vendor type / City / Search-button search-bar elements render twice in the DOM (one display:none breakpoint twin) — aria-label selectors hit Playwright strict-mode violations
metadata:
  type: project
---

Both the hero (`/`) and compact (`/search` header) search bars render two
copies of each combobox input (`aria-label="Vendor type"`, `aria-label="City"`)
and of the submit `button` with text "Search" — one live/visible, one with a
`display: none` ancestor (looks like a responsive/breakpoint duplicate, not a
bug: `getBoundingClientRect()` on the hidden one is legitimately `0,0,0,0` and
its ancestor computed style really is `display: none`).

**Why:** unknown structural reason (mobile sheet vs desktop bar?) but confirmed
harmless — the hidden twin never paints and never receives focus.

**How to apply:** a bare `input[aria-label="City"]` or `button:has-text("Search")`
CSS selector will throw a Playwright strict-mode "resolved to 2 elements"
error. Disambiguate with `browser_evaluate` — filter
`Array.from(document.querySelectorAll(...)).find(el => el.offsetParent !== null)`
to grab the visible one, read its `id`, then target that id string directly.
Also see [[mcp-ref-click-fails-on-combobox-role]] for why ref-based
click/type calls fail separately on these same elements.
