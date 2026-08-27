import { toDateString, pageTitle } from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AvailabilityCalendar } from '@/components/availability/availability-calendar';
import { requireRole } from '@/lib/current-user';
import { getOwnAvailability, getOwnVendorProfile } from '@/lib/vendor-data';

export const metadata: Metadata = { title: pageTitle('Availability') };

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

  return (
    // The calendar owns its own heading row, because the month range sits on
    // the heading's baseline and is driven by the calendar's own state — see
    // frame `11 Availability`. `data-app-shell` is what globals.css keys the
    // footer suppression off: this surface owns the viewport.
    <div data-app-shell className="w-full px-4 pt-5.5 sm:px-6 lg:app-shell lg:px-0 lg:pl-6">
      <AvailabilityCalendar initialEntries={entries} today={toDateString(new Date())} />
    </div>
  );
}
