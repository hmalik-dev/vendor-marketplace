---
name: review-checklist-blur-error-shifts-the-click-target
description: Blur validation on an autoFocus'd field inserts an error line on mousedown, moving the button below it before mouseup, so the click is swallowed
metadata:
  type: feedback
---

Diff shape: a form gains `autoFocus` on its first input plus `onBlur` validation that renders an error `<p>` under the field, with buttons stacked below (VEN-744, customer-details-form).

What to ask: on a fresh mount, press on the control _below_ the field. mousedown blurs the input, React flushes the error synchronously, the control moves down by (error line + gap) before mouseup; if that exceeds the control's height, mousedown and mouseup targets differ and `click` goes to their common ancestor. Here: 11.5px `text-helper` + 6px gap = ~20px shift vs a 16px `text-action` Sign out link, so the first click on Sign out never fires.

**Why:** jsdom has no layout, so unit tests (user.tab() then assert error) stay green; only a real browser shows it.

**How to apply:** for any blur-validated field with controls beneath it, compute the shift vs the target's height, and ask for a browser click on the lower control with the field focused. Window blur (tab switch) also fires the field's blur.
