---
name: data-rights-export-is-hand-enumerated
description: exportUserData's `subject` block lists users columns by hand, so a new PII column on users is disclosed to operators by readUserDataRights but silently missing from the subject's own DSAR export
metadata:
  type: project
---

`apps/api/src/modules/admin/data-rights.service.ts` has two readers of the same
`users` row and they are built differently:

- `readUserDataRights` (≈ line 585) — what `/admin/users/[userId]` shows an
  operator. Fields are added here as they are added to the schema.
- `exportUserData` (≈ line 216) — the subject's own copy. Its `subject` block is
  a **hand-enumerated literal** of `users` columns.

So a new personal-data column on `users` lands in the console and not in the
export unless its author edits both. #462 added `pending_email` /
`email_sync_failed_at` and hit exactly this: the address the identity provider
holds for that person is shown to staff and absent from the person's own file.
The doc comment above `readUserDataRights` even claims the console "cannot
quietly report a smaller record than the export hands over" — the drift runs the
other way and nothing tests the pair against each other.

**Why:** an Art. 15 access request is answered from `exportUserData`. Personal
data held and not exported is the failure, and the export's shape makes the
omission the default rather than the exception.

**How to apply:** on any diff adding a column to `users` (or to `vendorProfiles`,
which the export enumerates the same way), check `exportUserData`'s literal and
`adminUserExportSchema` alongside the console read. Also check closure —
`retireUserById` writes only `deleted_at`, so every one of these columns
survives a closed account. Related:
[[legal-acceptance-record-is-undeletable-pii]],
[[retired-users-keep-their-email-in-the-unique-index]],
[[response-schemas-are-a-second-write-boundary]].
