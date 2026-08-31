'use client';

import { formatPrice } from '@vendor-marketplace/shared';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WireAdminMetrics } from '@/lib/wire-schemas';

export interface MetricSeries {
  title: string;
  /** The token this series is drawn in, chosen by meaning rather than by order. */
  stroke: string;
  points: readonly { date: string; value: number }[];
  /** Formats a value for the axis and the tooltip. */
  format: (value: number) => string;
}

const AXIS_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** `YYYY-MM-DD` read as the calendar date it is — never through local time. */
function axisLabel(date: string): string {
  return AXIS_DATE.format(new Date(`${date}T00:00:00Z`));
}

function Chart({ title, stroke, points, format }: MetricSeries): React.ReactElement {
  return (
    <section className="rounded-xl border border-stone-300 bg-stone-0 p-4">
      <h2 className="text-label font-semibold tracking-label text-stone-600 uppercase">{title}</h2>
      <div className="mt-3 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[...points]} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-stone-200)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={axisLabel}
              // Six labels across thirty days: one a week, plus the ends.
              interval={5}
              tick={{ fill: 'var(--color-stone-600)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-stone-300)' }}
            />
            <YAxis
              width={54}
              tickFormatter={format}
              tick={{ fill: 'var(--color-stone-600)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              /*
                Recharts types both callbacks against its own loose value union,
                so they are narrowed here rather than annotated as `number` and
                `string` — which does not compile, and would be a lie about what
                the library can pass.
              */
              formatter={(value) => [format(Number(value)), title]}
              labelFormatter={(label) => axisLabel(String(label))}
              contentStyle={{
                background: 'var(--color-stone-0)',
                border: '1px solid var(--color-stone-300)',
                borderRadius: 'var(--radius-lg)',
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={2}
              dot={false}
              // The console is an ops tool read at a glance; an entry animation
              // on four charts is 1.2s of nothing to read.
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/**
 * The Overview's four series, colour-coded by meaning per `22-admin.md`:
 * revenue gold, bookings clay, users steel, completion sage. The colour is the
 * subject, not the position — reordering the grid must not recolour a line.
 */
export function MetricCharts({ metrics }: { metrics: WireAdminMetrics }): React.ReactElement {
  const count = (value: number): string => String(value);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Chart
        title="Revenue"
        stroke="var(--color-gold-400)"
        points={metrics.revenueByDay}
        format={(value) => formatPrice(value)}
      />
      <Chart
        title="Bookings"
        stroke="var(--color-clay-400)"
        points={metrics.bookingsByDay}
        format={count}
      />
      <Chart
        title="Signups"
        stroke="var(--color-steel-600)"
        points={metrics.signupsByDay}
        format={count}
      />
      <Chart
        title="Completed"
        stroke="var(--color-sage-400)"
        points={metrics.completedByDay}
        format={count}
      />
    </div>
  );
}
