---
name: conversation-read-grant-is-an-open-case-row
description: GET /admin/conversations/:id/messages is the only route where staff read two other people's private messages; the whole grant is one support_cases row, so audit the writers of subject_type='conversation' rather than the route
metadata:
  type: project
---

#436 added the first staff read of a private thread. The route
(`apps/api/src/modules/admin/admin.routes.ts`, `readCaseConversation` in
`modules/cases/cases.service.ts`) carries `onRequest: adminOnly`
(`requireRoleBeforeValidation('admin')`, local `users.role`), but the guard is
not where the interesting question lives.

**The grant is a row, and the row has exactly one writer.** A read is permitted
iff `support_cases` has a row with `status='open' AND subject_type='conversation'
AND subject_id=<this conversation>` (`findOpenCaseForConversation`,
`cases.dao.ts`). Audited 2026-09-07 and clean:

- `insertSupportCase` has three call sites, all in `cases.service.ts`. Only
  `openReportCase` (reached from `POST /reports`) ever sets `subject_type`.
- `POST /reports` refuses a conversation the caller is not a party to, with the
  **same 404** a missing conversation gets (`resolveSubject` +
  `conversationSubject`'s `restrictedTo = [customerId, vendorProfiles.userId]`).
  So an admin cannot self-issue a grant by reporting somebody else's thread.
- There is no re-open. `status` is only ever written to `'resolved'`
  (`markCaseResolved`, `markCaseResolvedForBooking`), both `WHERE status='open'`.
- The lookup is keyed **from the conversation**, so holding a case id and pairing
  it with a thread of your choosing does not work.
- The `admin_actions` row rides the same `db.transaction` as the select and is a
  plain insert with no conflict clause — a read that cannot be logged does not
  happen. `detail` is `{caseId, reference, page, pageSize}` only.

**How to apply:** any future writer of `support_cases.subject_type` — a seed, a
webhook, an admin "attach evidence" control, a second report endpoint — widens
staff access to private messages, and nothing in the DDL stops it: `subject_id`
carries no FK, there is no CHECK tying `subject_type` to `origin='user_report'`,
and `findOpenCaseForConversation` does not filter on `origin`. Each of those is
harmless only while the participant check in `resolveSubject` is the sole path.
Check that first; the route guard is settled.

The privacy policy states this in words
(`apps/web/content/legal/privacy.md`, "One exception…") — scoped to the reported
thread, only while open, logged, no staff writes — and all four halves matched
the code as of #436. Related: [[support-cases-is-the-first-durable-copy-of-a-complaint]],
[[admin-action-log-is-trigger-immutable]],
[[messaging-tenancy-is-two-statements]].
