'use client';

import dynamic from 'next/dynamic';
import type { WireAdminMetrics } from '@/lib/wire-schemas';

/**
 * Recharts, off the Overview's critical path.
 *
 * `ResponsiveContainer` measures its parent with a `ResizeObserver` and renders
 * nothing until the width is known, so the server pass produces four empty
 * divs — the whole library was ~129 kB of blocking JS bought for markup that
 * paints nothing. Loading it after the shell lets the four metric cards above
 * it become interactive first.
 *
 * A client wrapper because `ssr: false` cannot be passed from a Server
 * Component; the skeleton reserves the charts' height so nothing shifts when it
 * arrives, which is `40-states.md`'s one-idiom rule rather than a spinner.
 */
const MetricChartsImpl = dynamic(
  () => import('./metric-charts').then((module) => module.MetricChartsImpl),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 xl:grid-cols-2" aria-hidden="true">
        {[0, 1, 2, 3].map((slot) => (
          <div key={slot} className="h-[15.5rem] rounded-xl border border-stone-300 bg-stone-0" />
        ))}
      </div>
    ),
  },
);

export function MetricCharts({ metrics }: { metrics: WireAdminMetrics }): React.ReactElement {
  return <MetricChartsImpl metrics={metrics} />;
}
