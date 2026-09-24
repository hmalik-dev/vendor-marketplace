---
name: hand-seeded-case-rows-need-a-valid-reference-and-terms-gates
description: A hand-inserted support_cases row 500s the admin page unless its reference matches ORL-XXXX-XX; a fresh lane's E2E accounts also sit behind accept-terms and the vendor agreement
metadata:
  type: project
---

On lane VEN-658 (2026-09-24), inserting a chargeback `support_cases` row with
`reference='CHB-VEN658'` made `/admin/cases/<id>` render the 500 page. The API
log (`~/.claude/jobs/<session>/tmp/api.log`, found via `lsof -p <api pid>`)
showed a `ResponseSerializationError` on the reference regex
`^ORL-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{2}$`.
That read like a feature bug and was only the seed. Use e.g. `ORL-VENA-58`.

Same pass: after `pnpm e2e:auth`, all three roles landed on `/accept-terms`
(Terms v1.1), and the vendor also needed `/vendor/agreement` v1.1 accepted
before `/vendor/payments` stopped redirecting. Accepting as the persistent
customer/vendor/admin is a normal lane step; never do it as the newcomer.

**How to apply:** validate a hand-seeded row against the shared zod schema's
patterns before blaming the page; and when every protected route lands on
accept-terms, accept once per role rather than reporting a redirect defect.
A customer hitting `/admin/*` reads "Something broke" while terms are
unaccepted and redirects cleanly to `/bookings` once they are (confounder).
