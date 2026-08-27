import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PortfolioManager } from '@/components/portfolio/portfolio-manager';
import { VendorSurface } from '@/components/vendor-surface';
import { requireRole } from '@/lib/current-user';
import { getOwnPortfolio, getOwnVendorProfile } from '@/lib/vendor-data';

export const metadata: Metadata = { title: 'Portfolio · VenMatch' };

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

export default async function VendorPortfolioPage(): Promise<React.ReactElement> {
  await requireRole('vendor');

  const profile = await getOwnVendorProfile();
  if (!profile) {
    redirect(PROFILE_EDIT_PATH);
  }

  const items = await getOwnPortfolio();

  return (
    <VendorSurface
      eyebrow="Your business"
      heading="Portfolio"
      description="The work that proves you can do it. Photos appear on your profile in the order below."
      aside={
        <p className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">
          {items.length === 0
            ? 'No photos yet'
            : `${items.length} ${items.length === 1 ? 'photo' : 'photos'}`}
        </p>
      }
    >
      <PortfolioManager initialItems={items} />
    </VendorSurface>
  );
}
