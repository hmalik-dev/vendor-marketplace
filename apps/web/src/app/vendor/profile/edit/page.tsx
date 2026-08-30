import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { VendorProfileForm } from '@/components/vendor-profile-form';
import { requireRole } from '@/lib/current-user';
import { getActiveTags, getCategories, getOwnVendorProfile } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Your storefront') };

/**
 * Both onboarding and later edits. A vendor with no profile yet gets the same
 * form with create copy rather than a separate onboarding route, so there is
 * one place where the shape of a business profile is defined.
 *
 * The form owns the whole shell here — its section rail replaces the vendor nav
 * on this screen, per frame `09 Vendor profile editor`.
 */
export default async function VendorProfileEditPage(): Promise<React.ReactElement> {
  await requireRole('vendor');

  const [profile, categories, allTags] = await Promise.all([
    getOwnVendorProfile(),
    /*
     * Required, not degrading: a storefront cannot be saved without a
     * category, so an empty select here would be a form the vendor can fill in
     * and never submit. See `ReferenceReadOptions` in `lib/vendor-data`.
     *
     * `fresh` because this is the one screen that posts these ids back: a
     * cached id can outlive the row it names, and the save is then refused for
     * a choice the vendor was offered (#222).
     */
    getCategories({ required: true, fresh: true }),
    getActiveTags({ required: true, fresh: true }),
  ]);

  return (
    <div data-app-shell className="w-full lg:app-shell">
      <VendorProfileForm profile={profile} categories={categories} allTags={allTags} />
    </div>
  );
}
