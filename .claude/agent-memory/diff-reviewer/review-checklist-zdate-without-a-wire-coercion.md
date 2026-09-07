---
name: review-checklist-zdate-without-a-wire-coercion
description: A new z.date() field in a shared response schema breaks the web client unless wire-schemas.ts extends it with z.coerce.date() — typecheck and both suites stay green
metadata:
  type: project
---

A `z.date()` field added to a schema in `packages/shared/src/schemas` serialises
to an ISO **string** over the wire, and `apps/web/src/lib/api-client.ts`
`safeParse`s the response with the same schema — so the screen throws
`API response for <path> did not match its schema` unless
`apps/web/src/lib/wire-schemas.ts` re-declares the field as `z.coerce.date()`.

**Why:** #423 added `releaseAt: z.date()` to `vendorDashboardSchema.nextPayout`
and left `wireVendorDashboardSchema = vendorDashboardSchema` (whose comment even
read _"No date fields, so no coercion is needed"_). `/vendor/dashboard` then 500s
for every vendor with an owed payout. Nothing catches it: `tsc` is happy because
the inferred type is `Date` either way, the API test asserts
`new Date(payout.releaseAt as string)` — proving the wire value is a string while
passing — and the component test hands the component a real `Date`.

**How to apply:** grep the diff for `z.date()` in `packages/shared/src/schemas`.
For each hit, find the matching `wire*Schema` in `apps/web/src/lib/wire-schemas.ts`
and check the field is coerced there. If the wire schema is a bare re-export
(`export const wireXSchema = xSchema`), that is the bug. Prove it in one line:
`z.object({ f: z.date() }).safeParse(JSON.parse(JSON.stringify({ f: new Date() })))`
is `false`. Related: [[review-checklist-widened-write-schema-vs-response-schemas]].

**The second shape, which has no wire schema to grep for (#432).** A _mutation_
response schema is passed to `useApi` straight from `@vendor-marketplace/shared`
— `call(path, { method: 'PUT', schema: adminPayoutRetryResultSchema })` — so
there is no `wire*Schema` at all and the "did you extend it" question never gets
asked. Grep the diff for `schema:` inside a client component and check whether
the schema it names is a shared one carrying a `z.date()`. When the action moves
money the misreport is the damage: `apiRequest` throws an `ApiClientError` with
the **200** status, `userFacingError` only suppresses `>= 500`, and
`ConfirmAction` holds its dialog open under a comment saying an open dialog
means the action did nothing — so a transfer that landed is reported as a
failure and `router.refresh()` never runs. The nullable case passes and the
success case fails, so a suite that only drives the failure path stays green.
