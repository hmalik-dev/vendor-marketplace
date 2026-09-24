---
name: self-closure-step-up-codes-are-essential-mail
description: VEN-680 self-serve account closure reuses the admin step-up store and startStepUp, whose send is essential — opening the operator's reserved email headroom to any customer
metadata:
  type: project
---

VEN-680 (`/users/me/close`, `/users/me/close/challenge`) reuses `StepUpStore` and
`startStepUp`. `startStepUp` sends with `essential: true`, and essential mail may
take the `ESSENTIAL_SEND_HEADROOM` (15) past the daily cap (80) that exists so
operator step-up codes still go out. Before VEN-680 only admins could trigger it;
now any customer can, 6/hour per account (per-account key only, no per-IP bound),
and sign-up is open. A few throwaway accounts exhaust the day and 503 every
operator step-up code (bans, closures, exports) until UTC midnight (see
[[email-send-cap-closure-is-sticky]]).

**Why:** a lever reserved for the abuse response became spendable by the abuser.
**How to apply:** any new customer-triggerable send must be non-essential;
`startStepUp` needs an `essential` parameter. Audited clean on the same diff:
no cross-purpose code reuse (admin routes are adminOnly, the close routes refuse
admin), attempt cap 5 × 6 challenges/h, email + D39 checked before the code is
spent, verified-email gate at `neon-auth.ts:114` rules out third-party bombing.
The "closed account resumes without a code" branch is reachable only by a
concurrent second request with the same live token (auth hook 401s a closed row,
no `openToLockedOut`), so self-serve can never resume an interrupted unwind —
that needs the console.
