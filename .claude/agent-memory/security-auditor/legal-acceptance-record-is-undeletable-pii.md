---
name: legal-acceptance-record-is-undeletable-pii
description: legal_acceptances stores IP + user agent that no legal page names and that the immutability trigger makes impossible to redact or delete
metadata:
  type: project
---

`legal_acceptances` (#427) stores `ip` and `user_agent` per acceptance, and the
`legal_acceptances_are_immutable` trigger refuses both UPDATE and DELETE while
the vendor's `vendor_profiles` row exists. There is therefore **no redaction
path and no deletion path** for that PII short of erasing the whole vendor
account. `apps/web/content/legal/privacy.md` lists what is collected and ends
"Nothing else"; it names neither value, and `vendor-agreement.md` does not tell
the vendor their address is recorded when they accept.

**Why:** the table's whole value is that it is true and unalterable in a
dispute, so the immutability is correct — but that same property turns any
column on it into permanent, unerasable personal data, and the privacy page is a
public claim the code has to satisfy the way the fee constants satisfy
`legalFactTokens()`.

**How to apply:** any diff that adds a column to `legal_acceptances`, or any new
collection of an address/device string anywhere, is also a change to
`privacy.md`. Do not accept "it is only recorded, never trusted" as the end of
the analysis — recorded _is_ the processing. Related: the delete branch keys on
`accepted_by_user_id`, not on the vendor's owner, so a future writer that
records an acceptance made by someone other than the profile owner makes those
rows deletable while the vendor lives. See
[[cancelled-by-does-not-say-which-side]] for the other place a stored actor id
is read as meaning something it does not.
