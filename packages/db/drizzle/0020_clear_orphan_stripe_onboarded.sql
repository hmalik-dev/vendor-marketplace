-- #381 makes "onboarded, but with no connected account" unrepresentable. This
-- is the **data** half and it has to run first: the CHECK constraint that
-- follows in `0021` is validated against every existing row, and it fails
-- outright on exactly the row that motivated the ticket.
--
-- That row was writable, and it was written. `be02b46` fixed one instance — the
-- E2E fixture set `stripe_onboarded` without `stripe_account_id` — and the
-- consequences read as two unrelated bugs on two surfaces. The customer's
-- `/bookings/<id>/checkout` answered **404**: `openCheckout` refuses a vendor
-- with no account id with a deliberate **402**, the web app folds 402 into
-- `null`, and the page turns `null` into `notFound()` — so the customer was
-- told the link may be old or the listing gone, every word of it false. The
-- operator console said the opposite: `admin.dao.ts`'s `Payouts: connected`
-- filter reads `stripe_onboarded` alone, so the same vendor was reported
-- payouts-connected. One impossible row, two surfaces, opposite answers.
--
-- Cleared rather than repaired, because there is nothing to repair it with: an
-- account id cannot be invented, and Stripe is the only thing that can issue
-- one. `false` is also the truthful value — a vendor with no connected account
-- has not onboarded, whatever the column said — and it is the state the product
-- already handles well, putting `Set up payouts` in front of them and refusing
-- an accept with a 402 rather than failing at the payment gate.
UPDATE "vendor_profiles"
   SET "stripe_onboarded" = false,
       "updated_at" = now()
 WHERE "stripe_onboarded" = true
   AND "stripe_account_id" IS NULL;
