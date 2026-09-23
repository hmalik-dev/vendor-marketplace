---
name: no-step-position-eyebrows
description: Never label a screen "One last step" or similar; the sign-up role is asked once, at sign-up, and never re-asked
metadata:
  type: feedback
---

No "One last step" / "Almost done" style eyebrows on any screen. The account holder removed them from `/accept-terms` (#439) and `/sign-up/name` (#440) on 2026-09-23. Also, the role chosen on the sign-up form is never asked again. `/accept-terms` states it, and asks only when this browser has no remembered choice for the signed-in address.

**Why:** "that's not a last step". The sign-up flow varies by path (customers get a name step after terms), so a position claim is false somewhere. Re-asking the role contradicts the sign-up form's "This can't be changed later".

**How to apply:** when building or reviewing any onboarding or interstitial screen, lead with the heading alone. Don't add a step-position label, and don't re-ask a decision the user already made. Related: [[design-is-a-contract-not-code]].
