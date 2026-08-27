import { toDateString } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AvailabilityCalendar } from '@/components/availability/availability-calendar';
import { VendorSurface } from '@/components/vendor-surface';
import { requireRole } from '@/lib/current-user';
import { getOwnAvailability, getOwnVendorProfile } from '@/lib/vendor-data';

export const metadata: Metadata = { title: 'Availability · VenMatch' };

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

/** The calendar is a live view of the next twelve months, never a cached one. */
export const dynamic = 'force-dynamic';

export default async function VendorAvailabilityPage(): Promise<React.ReactElement> {
  await requireRole('vendor');

  const profile = await getOwnVendorProfile();
  if (!profile) {
    redirect(PROFILE_EDIT_PATH);
  }

  const entries = await getOwnAvailability();
  const blockedCount = entries.filter((entry) => entry.status === 'blocked').length;

  return (
    <VendorSurface
      eyebrow="Your business"
      heading="Availability"
      description="Block the dates you are away. Everything else stays open for requests."
      fills
      aside={
        <p className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">
          {blockedCount === 0
            ? 'Every future date is open'
            : `${blockedCount} blocked ${blockedCount === 1 ? 'date' : 'dates'}`}
        </p>
      }
    >
      <AvailabilityCalendar initialEntries={entries} today={toDateString(new Date())} />
    </VendorSurface>
  );
}
