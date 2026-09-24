---
name: friends-beta-needs-no-domain
description: "Ruling 2026-09-22 — the friends beta ships without a domain; email goes via onboarding@resend.dev (owner-only delivery), the domain stays in VEN-595"
metadata:
  node_type: memory
  type: project
  originSessionId: ca6f4644-9c80-432b-85ab-1742d6f5b979
  modified: 2026-09-23T01:00:45.199Z
---

The account holder ruled on 2026-09-22 that the friends beta does not need a domain. The domain, its DNS records, and a Resend-verified sender all stay deferred to VEN-595/VEN-563.

Consequences:
- Production sends from `onboarding@resend.dev`. That address delivers only to the Resend account owner, so friends get in-app notifications only and no Orla email.
- Neon Auth sends its own sign-in codes, so sign-in is unaffected.
- `OPERATOR_ALERT_EMAIL` and the admin's email must be the owner's address, or the step-up code and operator alerts are lost too.

VEN-609 (`ce9c5852`) made releases require a verified sender, which blocks every production release until VEN-626 accepts `onboarding@resend.dev` at release time. `launch:check` stays strict.

**Why:** friends are a small test-mode group. Buying a domain is a real-launch step.

**How to apply:** never file "no domain" or "no verified sender" as a friends-beta blocker again. Do file anything that breaks when the sender is `onboarding@resend.dev`, or that assumes a friend receives email. Related: [[beta-uses-real-signups-not-seeded-data]], [[environments-model-and-provider-gotchas]].
