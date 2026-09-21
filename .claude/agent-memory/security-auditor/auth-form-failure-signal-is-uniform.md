---
name: auth-form-failure-signal-is-uniform
description: Sign-in/sign-up refusals are one app-owned sentence and one boolean that marks every field alike — any per-field or per-outcome signal is an account-enumeration oracle
metadata:
  type: project
---

Both auth forms hold a single `failure: string | null`. It is set only from
`AUTH_COPY` (`signInFailed`, `signUpFailed`, `unreachable`) — never from the
Neon Auth proxy's response — and it drives, identically, the `Banner` and
`aria-invalid` on the email field and the password field
(`apps/web/src/components/auth/sign-in-form.tsx`, `sign-up-form.tsx`).

**Why:** the sign-in refusal must not tell a stranger whether an address has an
account. A second state variable, a per-field flag, or an upstream `message`
reaching `setFailure` turns the form into an enumeration oracle — and the
machine-readable `aria-invalid` is a cleaner oracle than the sentence, because
it reads without parsing prose. VEN-542 added `role="alert"` + `aria-invalid`
and kept both properties; audited clean 2026-09-21.

**How to apply:** on any auth-form diff, check three things — the sentence comes
from `AUTH_COPY`, the two fields take the same expression, and no outcome other
than `unverified` (which routes to the code step, a pre-existing and accepted
signal) branches the UI. See [[email-uniqueness-is-partial-nothing-joins-by-email]].
