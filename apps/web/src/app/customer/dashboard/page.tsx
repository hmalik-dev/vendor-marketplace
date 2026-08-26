import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard-shell';
import { requireRole } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Your events · VenMatch' };

const SECTIONS = [
  {
    title: 'Find vendors',
    description: 'Search photographers, DJs, caterers, and florists near your event.',
    arrivesIn: 'Ticket #6',
  },
  {
    title: 'Booking requests',
    description: 'Track quotes, accept the one you want, and pay in one place.',
    arrivesIn: 'Tickets #7 and #10',
  },
  {
    title: 'Messages',
    description: 'Talk to vendors about timings, headcount, and the last details.',
    arrivesIn: 'Ticket #8',
  },
] as const;

export default async function CustomerDashboardPage(): Promise<React.ReactElement> {
  const user = await requireRole('customer');

  return (
    <DashboardShell
      eyebrow="Customer"
      heading={`Welcome back, ${user.firstName || 'there'}`}
      description="This is where your events, requests, and vendor conversations will live."
      sections={SECTIONS}
    />
  );
}
