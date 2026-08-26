import type { Metadata } from 'next';
import { DashboardShell } from '@/components/dashboard-shell';
import { requireRole } from '@/lib/current-user';

export const metadata: Metadata = { title: 'Your business · VendorHub' };

const SECTIONS = [
  {
    title: 'Business profile',
    description: 'Your public page: story, service area, categories, and languages.',
    arrivesIn: 'Ticket #3',
  },
  {
    title: 'Packages and portfolio',
    description: 'What you offer, what it costs, and the work that proves it.',
    arrivesIn: 'Ticket #4',
  },
  {
    title: 'Availability',
    description: 'Block the dates you are away so requests only reach you when free.',
    arrivesIn: 'Ticket #5',
  },
  {
    title: 'Getting paid',
    description: 'Connect a Stripe account and receive payouts after each event.',
    arrivesIn: 'Ticket #9',
  },
] as const;

export default async function VendorDashboardPage(): Promise<React.ReactElement> {
  const user = await requireRole('vendor');

  return (
    <DashboardShell
      eyebrow="Vendor"
      heading={`Welcome back, ${user.firstName || 'there'}`}
      description="Set up your business here, then start receiving booking requests."
      sections={SECTIONS}
    />
  );
}
