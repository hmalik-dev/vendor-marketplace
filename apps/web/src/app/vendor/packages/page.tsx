import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { redirect } from 'next/navigation';
import { PackageManager } from '@/components/packages/package-manager';
import { VendorSurface } from '@/components/vendor-surface';
import { requireRole } from '@/lib/current-user';
import { getOwnPackages, getOwnVendorProfile } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Packages') };

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

export default async function VendorPackagesPage(): Promise<React.ReactElement> {
  await requireRole('vendor');

  const profile = await getOwnVendorProfile();

  // Packages hang off a business profile, so there is nothing to manage until
  // the vendor has described the business itself.
  if (!profile) {
    redirect(PROFILE_EDIT_PATH);
  }

  const packages = await getOwnPackages();
  const activeCount = packages.filter((servicePackage) => servicePackage.isActive).length;

  return (
    <VendorSurface
      eyebrow="Your business"
      heading="Packages"
      description="What a customer books, and what it costs. At least one bookable package is needed before your profile can go live."
      fills
      aside={
        <p className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">
          {activeCount === 0
            ? 'Nothing bookable yet'
            : `${activeCount} bookable ${activeCount === 1 ? 'package' : 'packages'}`}
          {profile.isPublished ? ' · profile is live' : ' · profile is hidden'}
        </p>
      }
    >
      <PackageManager initialPackages={packages} isPublished={profile.isPublished} />
    </VendorSurface>
  );
}
