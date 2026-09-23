import { pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CustomerDetailsForm } from '@/components/customer-details-form';
import { requireRole } from '@/lib/current-user';
import { pathReturningTo, RETURN_PATH_PARAM, safeReturnPath } from '@/lib/return-path';

export const metadata: Metadata = { title: pageTitle('Add your name') };

/** Who has already cleared this step changes what renders, so no cached copy. */
export const dynamic = 'force-dynamic';

/**
 * The mandatory name step every customer passes once, right after
 * `/accept-terms` and before anywhere else (VEN-642): `users.firstName` and
 * `lastName` are real `NOT NULL` columns, and the only value a fresh sign-up
 * ever gives them is the sign-up form's synthetic email-prefix placeholder.
 *
 * `requireRole('customer', …)` does the two bounces this step needs for free:
 * signed-out to sign-in, and a vendor session to its own dashboard — a vendor
 * reaches the equivalent step through their profile editor instead.
 */
export default async function CustomerDetailsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const raw = (await searchParams)[RETURN_PATH_PARAM];
  const returnTo = safeReturnPath(Array.isArray(raw) ? raw[0] : raw);

  const user = await requireRole('customer', returnTo ?? undefined);

  // Already has a real name: nothing to do here. `/after-sign-in` resolves
  // where this customer actually goes next.
  if (user.firstName.trim() && user.lastName.trim()) {
    redirect(pathReturningTo('/after-sign-in', returnTo));
  }

  return <CustomerDetailsForm returnTo={returnTo} />;
}
