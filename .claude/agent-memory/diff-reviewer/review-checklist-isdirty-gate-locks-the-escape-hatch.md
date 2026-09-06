---
name: review-checklist-isdirty-gate-locks-the-escape-hatch
description: Disabling a state-writing control while the form is dirty locks the user out whenever the dirty edit is itself unsavable — clear a required field and check both directions
metadata:
  type: feedback
---

When a diff gates a control that writes **saved** state on `!isDirty`
(`disabled={isSaving || isDirty}` on a publish/visibility switch, a "make
default", a delete), ask the second question: **is every dirty state
reachable also savable?**

**Why:** #405's storefront editor made the publish switch always render on a
published storefront and disabled it while dirty, with a comment claiming the
vendor is "one Save away from usable". But `businessName` is `min(2)` and
`categoryIds` is `min(1)` in the client schema, so clearing either makes
`useSubmitValidation.attemptSubmit` refuse to send — the form is permanently
dirty and the switch permanently disabled. A published vendor who cleared their
business name could not take their storefront down. Escape was reload or
retyping the exact prior value.

**How to apply:**

1. List the client-schema `min`/`required` constraints on the form's fields.
2. Clear one. The form is now dirty _and_ unsavable.
3. Drive it: does the gated control still offer the action the comment promises?
4. The RTL probe is ~40 lines — `user.clear(getByLabelText(<required field>))`,
   then assert `getByRole('switch').hasAttribute('disabled')` and
   `expect(requestMock).not.toHaveBeenCalled()` after clicking Save.

A shipped test asserting the control _renders_ (`expect(getByRole('switch'))
.toBeTruthy()`) passes while it is disabled — presence is not usability. If the
diff's test only checks presence, write the disabled probe yourself.

Related: [[review-checklist-layout-gate-checked-at-its-own-route]],
[[review-checklist-relaxation-clears-half-a-paired-filter]].
