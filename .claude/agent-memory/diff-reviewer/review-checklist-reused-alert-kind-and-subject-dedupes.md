---
name: review-checklist-reused-alert-kind-and-subject-dedupes
description: A new operator-alert variant that reuses an existing kind AND subjectId is silently deduped for the whole window; check every other dispatcher of that kind before believing "one alert is raised"
metadata:
  type: feedback
---

When a diff adds a new alert variant by reusing an existing `kind`, the alert
that matters is the one the dedupe key swallows.

**Why:** `alertNow` in `apps/api/src/modules/operator-alerts/operator-alerts.service.ts`
records on `kind + subjectId` and returns `'deduplicated'` inside
`OPERATOR_ALERT_DEDUPE_MS` (6 hours). A ticket AC of the form "raises one
operator alert" is satisfied by a test that dispatches exactly one alert, so the
suppression never shows up in the suite.

**How to apply:** grep every caller of the composer (and every other composer
sharing the kind). If two of them can fire for the same subject inside the
window — a failure alert, then the successful-retry-with-a-different-problem
alert — the second is lost. The repo's own precedent is to qualify the subject
(`pi:${id}`, `${id}:refunded`, `${bookingId}:${cents}`) so variants dedupe apart
while keeping the mandated kind; a diff that reuses the bare id is the defect.

Second half of the same review: a test that asserts an error log is _absent_
needs `env: { LOG_LEVEL: 'trace' }` alongside its `loggerStream` — `TEST_ENV`
defaults to `silent`, so the collector stays empty and the assertion cannot fail.

Related: [[review-checklist-guard-moved-to-onrequest-shadows-route-hooks]],
[[review-checklist-status-filter-vs-webhook-idempotency]].
