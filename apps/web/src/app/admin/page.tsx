import Link from 'next/link';
import { formatPrice } from '@vendor-marketplace/shared';
import { AdminSurface } from '@/components/admin/admin-surface';
import { MetricCharts } from '@/components/admin/metric-charts';
import { getAdminMetrics } from '@/lib/admin-data';

interface MetricCard {
  label: string;
  value: string;
  /** Where the number is worked on. A card that leads nowhere is furniture. */
  href: string;
}

/**
 * The console's Overview: four metric cards, then the four charts.
 *
 * Every number is a query result read at request time — the no-invented-numbers
 * law, which this surface satisfies twice over: nothing here is a platform
 * statistic on a public page, because the whole screen is admin-only.
 *
 * There is no zero-data special case and there does not need to be. A platform
 * with nothing in it renders four zeros and four flat lines, which is the state
 * rather than a blank pane — the API fills every day of the window, so a quiet
 * month draws a line along the floor instead of nothing at all.
 */
export default async function AdminOverviewPage(): Promise<React.ReactElement> {
  const metrics = await getAdminMetrics();

  const cards: MetricCard[] = [
    {
      label: 'Revenue',
      value: formatPrice(metrics.totalRevenueCents),
      href: '/admin/payments',
    },
    { label: 'Bookings', value: String(metrics.bookingsCount), href: '/admin/bookings' },
    { label: 'Live vendors', value: String(metrics.activeVendorsCount), href: '/admin/vendors' },
    { label: 'Accounts', value: String(metrics.usersCount), href: '/admin/customers' },
  ];

  return (
    <AdminSurface
      heading="Overview"
      counts={[
        `${metrics.pendingTagSuggestionsCount} tag ${metrics.pendingTagSuggestionsCount === 1 ? 'suggestion' : 'suggestions'} waiting`,
        `last 30 days`,
      ]}
    >
      <div className="h-full min-h-0 overflow-y-auto pb-2">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-xl border border-stone-300 bg-stone-0 p-4 transition-shadow duration-(--duration-base) hover:shadow-hover"
            >
              <p className="text-label font-semibold tracking-label text-stone-600 uppercase">
                {card.label}
              </p>
              <p className="mt-1.5 display-heading text-display-md text-stone-900">{card.value}</p>
            </Link>
          ))}
        </div>

        <div className="mt-4">
          <MetricCharts metrics={metrics} />
        </div>
      </div>
    </AdminSurface>
  );
}
