---
name: vendor-marketplace-e2e-credentials
description: Where the end-to-end test account credentials live locally
metadata: 
  node_type: memory
  type: reference
  originSessionId: c8313b59-6214-4b3d-a8e0-2bed9f92a143
  modified: 2026-08-26T22:35:04.790Z
---

The project keeps **one reusable Clerk account per role** in `~/Documents/vendor-marketplace/.env.e2e.local`: `E2E_CUSTOMER_EMAIL` / `E2E_CUSTOMER_PASSWORD` (`customer+clerk_test@example.com`) and `E2E_VENDOR_EMAIL` / `E2E_VENDOR_PASSWORD` (`vendor+clerk_test@example.com`). Both share one password. The file is gitignored by the `.env.*.local` rule — never commit it, never echo a password into a transcript, and read the values from the file rather than copying them anywhere else.

Two accounts rather than one because the roles see genuinely different surfaces: a signed-in vendor is redirected off `/` to their own dashboard while a customer stays on the marketplace home, so a single account cannot drive both halves of a ticket's flows.

`packages/preflight/src/checks/browser.ts` owns the contract — `E2E_ACCOUNTS` declares the roles and `pnpm preflight --ticket <n>` fails until all four keys are present. Add a role there, not ad hoc in a spec.

Use these for the browser-verification pass in [[vendor-marketplace-playwright-verification]]. For throwaway *sign-ups*, prefer a fresh `+clerk_test` address with the fixed verification code `424242` so these two stay clean; use the saved accounts for sign-in and returning-user flows. Signing out of a Playwright session to test signed-out surfaces is fine — signing back in with these credentials restores it.
