import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { VendorProfileForm } from '@/components/vendor-profile-form';
import { requireRole } from '@/lib/current-user';
import { getActiveTags, getCategories, getOwnVendorProfile } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Your business profile') };

/**
 * Both onboarding and later edits. A vendor with no profile yet gets the same
 * form with create copy rather than a separate onboarding route, so there is
 * one place where the shape of a business profile is defined.
 */
export default async function VendorProfileEditPage(): Promise<React.ReactElement> {
  await requireRole('vendor');

  const [profile, categories, allTags] = await Promise.all([
    getOwnVendorProfile(),
    getCategories(),
    getActiveTags(),
  ]);

  const isNew = profile === null;

  // An app surface, so the title is capped at `text-2xl`: a 60px headline here
  // would spend the vertical budget on a word the vendor already knows.
  return (
    <div className="mx-auto w-full max-w-[65rem] px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
      <header className="max-w-prose">
        <p className="text-[10.5px] font-semibold tracking-[.05em] text-stone-600 uppercase">
          {isNew ? 'Get started' : 'Your business'}
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-stone-800">
          {isNew ? 'Set up your business profile' : 'Edit your business profile'}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {isNew
            ? 'Tell customers who you are. You can change any of this later.'
            : 'Keep your details current so the right customers find you.'}
        </p>
      </header>

      <div className="mt-6">
        <VendorProfileForm profile={profile} categories={categories} allTags={allTags} />
      </div>
    </div>
  );
}
