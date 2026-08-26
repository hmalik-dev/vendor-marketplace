import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, Circle } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard-shell';
import { TAG_PILL_CLASSES } from '@/components/tags/tag-display';
import { Button } from '@/components/ui/button';
import { requireRole } from '@/lib/current-user';
import { cn } from '@/lib/utils';
import { getOwnVendorProfile } from '@/lib/vendor-data';

export const metadata: Metadata = { title: 'Your business · VenMatch' };

const PROFILE_EDIT_PATH = '/vendor/profile/edit';

const SECTIONS = [
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
  const profile = await getOwnVendorProfile();

  // A vendor with no profile has nothing to manage yet, so sign-up leads
  // straight into creating one rather than to an empty dashboard.
  if (!profile) {
    redirect(PROFILE_EDIT_PATH);
  }

  const isComplete = profile.publishBlockers.length === 0;

  return (
    <DashboardShell
      eyebrow="Vendor"
      heading={`Welcome back, ${user.firstName || 'there'}`}
      description="Set up your business here, then start receiving booking requests."
      sections={SECTIONS}
    >
      <section
        className={cn(
          'mt-8 rounded-lg border p-5 shadow-sm sm:p-6',
          isComplete ? 'border-sage-200 bg-sage-50' : 'border-gold-200 bg-gold-100',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-stone-800">
              {profile.businessName}
            </h2>
            <p className="mt-1 text-sm text-stone-700">
              {profile.isPublished
                ? 'Your profile is live and customers can find you.'
                : isComplete
                  ? 'Your profile is ready — turn on visibility to go live.'
                  : 'Finish these steps to publish your profile.'}
            </p>
          </div>
          <Button asChild variant="cta" size="cta">
            <Link href={PROFILE_EDIT_PATH}>{isComplete ? 'Edit profile' : 'Complete profile'}</Link>
          </Button>
        </div>

        {!isComplete ? (
          <ul className="mt-4 space-y-2">
            {profile.publishBlockers.map((blocker) => (
              <li key={blocker} className="flex items-center gap-2 text-sm text-stone-700">
                <Circle aria-hidden="true" className="size-4 shrink-0 text-stone-400" />
                {blocker}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-stone-700">
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-sage-600" />
            Every prerequisite is met.
          </p>
        )}

        {profile.tags.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {profile.tags.map((tag) => (
              <li key={tag.id}>
                <span
                  className={cn(
                    'inline-block rounded-full px-3 py-1 text-sm',
                    TAG_PILL_CLASSES[tag.category],
                  )}
                >
                  {tag.name}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </DashboardShell>
  );
}
