import type { Metadata } from 'next';
import { VendorProfileForm } from '@/components/vendor-profile-form';
import { requireRole } from '@/lib/current-user';
import { getActiveTags, getCategories, getOwnVendorProfile } from '@/lib/vendor-data';

export const metadata: Metadata = { title: 'Your business profile · VendorHub' };

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

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-sm font-medium tracking-wide text-primary-600 uppercase">
          {isNew ? 'Get started' : 'Your business'}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-stone-800 sm:text-4xl">
          {isNew ? 'Set up your business profile' : 'Edit your business profile'}
        </h1>
        <p className="mt-3 text-stone-600">
          {isNew
            ? 'Tell customers who you are. You can change any of this later.'
            : 'Keep your details current so the right customers find you.'}
        </p>
      </header>

      <div className="mt-8">
        <VendorProfileForm profile={profile} categories={categories} allTags={allTags} />
      </div>
    </div>
  );
}
