import { formatPrice } from '@vendor-marketplace/shared';
import type { WireVendorDashboard } from '@/lib/wire-schemas';

interface StatProps {
  label: string;
  value: string;
  /** The line under the number. Sage when it is good news, muted otherwise. */
  delta: string;
  isPositive?: boolean;
}

function Stat({ label, value, delta, isPositive = false }: StatProps): React.ReactElement {
  return (
    /*
      12px, not `rounded-xl`. Frame `08` overrides `.card`'s 16px radius
      on the stat row specifically, and the scale has no 12px step —
      `--radius-lg` is 10px and `--radius-xl` 14px — so the value is
      written literally rather than forced into a neighbouring token,
      the same way `RoleChip` writes its 5px.
    */
    <li className="rounded-[12px] bg-stone-0 p-3.25 shadow-sm">
      <p className="text-label font-semibold tracking-label text-stone-600 uppercase">{label}</p>
      <p className="mt-1 font-display text-[30px] leading-none text-stone-900">{value}</p>
      {/*
        11.5px — `text-helper`, not `text-xs`. Frame `08` draws the delta line
        at 11.5px and the `text-xs` step is 11px.
      */}
      <p className={`mt-1 text-helper ${isPositive ? 'text-sage-600' : 'text-stone-600'}`}>
        {delta}
      </p>
    </li>
  );
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });

export interface DashboardStatsProps {
  dashboard: WireVendorDashboard;
  /** `YYYY-MM-DD`; the previous month's name is derived from it. */
  today: string;
}

/**
 * The vendor's own four numbers.
 *
 * Every one is a query over their own rows — none is a platform statistic and
 * none makes a ranking claim. There is deliberately **no reply-time figure**:
 * frame `08` draws one, and it is the single recorded deviation from that
 * frame, because the median needs message history a new vendor does not have
 * and "to stay ranked" promises a signal that does not exist.
 */
export function DashboardStats({ dashboard, today }: DashboardStatsProps): React.ReactElement {
  const [year, month] = today.split('-').map(Number);
  const previous = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 2, 1));
  const change = dashboard.bookingsThisMonth - dashboard.bookingsLastMonth;

  return (
    // Four across from `lg` and never stacked above it — the 1024 rule is that
    // a grid loses a column before a card loses information, and at four
    // narrow cards there is nothing left to lose.
    <ul className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Bookings this month"
        value={String(dashboard.bookingsThisMonth)}
        delta={
          dashboard.bookingsLastMonth === 0 && dashboard.bookingsThisMonth === 0
            ? `None in ${MONTH.format(previous)}`
            : `${change >= 0 ? '+' : ''}${change} vs ${MONTH.format(previous)}`
        }
        isPositive={change > 0}
      />
      <Stat
        label="Response rate"
        // `null` means nobody has asked yet. "0%" would read as a bad record
        // rather than an absent one.
        value={
          dashboard.responseRate === null ? '—' : `${Math.round(dashboard.responseRate * 100)}%`
        }
        delta={dashboard.responseRate === null ? 'No requests yet' : 'Last 30 days'}
      />
      <Stat
        label="Rating"
        value={dashboard.reviewCount === 0 ? '—' : dashboard.avgRating.toFixed(1)}
        delta={
          dashboard.reviewCount === 0
            ? 'No reviews yet'
            : `${dashboard.reviewCount} ${dashboard.reviewCount === 1 ? 'review' : 'reviews'}`
        }
      />
      <Stat
        label="Earnings this month"
        value={formatPrice(dashboard.earningsThisMonthCents)}
        // Payout scheduling is #9/#10; naming a date before it exists would be
        // a promise nothing keeps.
        delta="Your share, after the platform fee"
      />
    </ul>
  );
}
