import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { DashboardShell } from '@/components/dashboard-shell';
import { requireRole } from '@/lib/current-user';

export const metadata: Metadata = { title: pageTitle('Your bookings') };

/*
 * One card, because one surface exists. Requests (#7, #22b) and messages (#8)
 * are drawn when they can be opened — a card that goes nowhere is furniture,
 * and naming the ticket that will build it is a note to us, not to the
 * customer. #22b replaces this page wholesale.
 */
const SECTIONS = [
  {
    title: 'Find vendors',
    description: 'Search photographers, DJs, caterers, and florists near your event.',
    href: '/search',
  },
] as const;

export default async function CustomerDashboardPage(): Promise<React.ReactElement> {
  await requireRole('customer');

  return (
    <DashboardShell
      eyebrow="Customer"
      heading="Welcome back"
      description="Find and compare event vendors near you."
      sections={SECTIONS}
    />
  );
}
