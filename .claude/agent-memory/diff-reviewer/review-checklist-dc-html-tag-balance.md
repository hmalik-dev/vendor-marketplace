---
name: review-checklist-dc-html-tag-balance
description: Any diff that re-cuts a block inside design/*.dc.html — count <div> vs </div> for the whole file before and after, then render both and compare each frame's closest('.sc')
metadata:
  type: feedback
---

**On any diff that rewrites markup inside `design/Orla - Screens.dc.html`, run a
tag-balance check and a rendered structure diff. Do not trust the test suite.**

**Why:** #385 (D30) replaced two multi-line checklist rails with one-line
equivalents. Each replacement line carried one surplus `</div>`, and one hunk
also dropped an opening wrapper whose closer survived on a context line — net
three extra closers. Chrome recovered by closing ancestors early, which pushed
frame `27 Vendor dashboard — empty · 1024` _out of_ its `<div class="sc">`
section: `closest('.sc')` went from screen 20 to `null`, and the frame moved
from `(1516, 23496)` beside its 1440 sibling to `(0, 24504)`, below the section
card and flush to the page's left edge where every other frame sits at x=48.
Nothing failed. The three frame-reading tests slice the file as a **string**
(`indexOf('data-screen-label=…')` to the next `class="fr"`), so a DOM-level
break is invisible to them, and 1909 tests stayed green.

**How to apply:**

1. Cheap first pass — counts must not drift:
   `len(re.findall(r'<div\b', h)) - len(re.findall(r'</div>', h))` on the parent
   blob and the working file. This file already carries a **pre-existing −1** at
   offset 38688 in section `01 Landing`; only a _change_ in the delta is a
   finding. Then attribute it per hunk: for each hunk compute the balance of the
   `-` lines vs the `+` lines and print the ones where they differ.
2. Then prove the visible effect. Render both versions in Chromium and diff
   `[...document.querySelectorAll('[data-screen-label]')].map(f =>
[f.dataset.screenLabel, f.closest('.sc')?.querySelector('.sc-n')?.textContent,
 rect, ancestorDepth])`.

**Two traps when rendering it:**

- The file loads `./support.js`, which upgrades `<x-dc>` into `div.sc-host`.
  Copy the before-blob **next to a copy of `design/support.js`** or the script
  404s, the DOM never upgrades, and every frame reports a depth one shallower —
  a whole-file false positive that looks exactly like a structural regression.
  Wait on `document.querySelectorAll('.sc-host').length > 0`, not a timeout.
- Frames render content-box (see [[review-checklist-design-frames-are-content-box]]):
  a `.fr` declared `width:1440px` with a 1px border measures **1442**, and
  `yRel` taken from its border-box top is 1px more than the position inside the
  frame. Subtract the border before comparing against a fold budget.

Related: [[review-checklist-source-grep-substring-collisions]] — a string-sliced
frame read is the same class of blind spot, one level up.
