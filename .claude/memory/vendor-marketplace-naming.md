---
name: vendor-marketplace-naming
description: Two names in play — vendor-marketplace for repo/infra/packages, Orla for anything a user sees
metadata:
  type: project
---

Two names, and which one applies depends on who reads the string:

- **`vendor-marketplace`** — repo, root package name, npm scope
  (`@vendor-marketplace/api|db|shared|config|preflight`), Docker container,
  volume and image names, Postgres role/database (`vendor_marketplace`, with
  underscores), the S3 bucket (`vendor-marketplace-uploads`), and tooling labels.
- **`Orla`** — every user-visible string: the page `<title>`, the header and
  footer wordmark, sign-up copy, outbound domains. It is **never written as a
  literal**: it lives in `packages/shared/src/constants/brand.ts` as
  `BRAND_NAME` / `BRAND_DOMAIN`, and a grep for the literal in `apps/web/src`
  should return zero hits outside that file.

History: VendorHub → vendor-marketplace + VenMatch (2026-08-26) → Orla
(2026-08-26, with the Orla design bundle). The constant exists because the name
has now moved twice; the logo mark is name-agnostic by construction — two
circles, no letterform — so a third move changes the wordmark text and nothing
else.

**Why:** the product name and the project name were settled at different times
and are deliberately allowed to differ. Renaming the npm scope is a ~120-file
change, which is why the infrastructure name is the boring one that stays put.

**How to apply:** when adding a user-visible string, read it from `BRAND_NAME` —
never type "Orla". Infrastructure and package identifiers stay
`vendor-marketplace`. Never reintroduce "VendorHub" or "VenMatch". Related:
[[vendor-marketplace-neon-dev-branch]], [[design-is-a-contract-not-code]].
