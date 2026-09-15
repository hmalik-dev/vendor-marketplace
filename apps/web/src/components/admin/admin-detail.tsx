import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * The detail-view pieces `design/delta-admin/` draws once and every console
 * detail route reuses (#393): the title band, the Pattern B grid, the `.ac`
 * card with its `.ach` header band, and the `.kv` label/value list.
 *
 * Server Components, all of them. Nothing here holds state, so a detail page
 * stays a Server Component and only its controls cross the client boundary.
 */

export interface DetailHeaderProps {
  /** The list this record belongs to — `Cases`, `Customers`. Omitted where there is none. */
  crumb?: { label: string; href: string };
  /** The last breadcrumb segment, usually the record's own handle. */
  current: string;
  /** Serif 23px, as on every console screen. */
  heading: string;
  /** Pills beside the heading. */
  pills?: ReactNode;
  /** The right-hand stat line: id, counts, age. */
  stat?: ReactNode;
}

/**
 * The band above a detail view: breadcrumb, heading with its pills, and a stat
 * line to the right — `padding:16px 24px 12px` on a `stone-300` bottom rule,
 * which is what separates identity from the record in both patterns.
 */
export function DetailHeader({
  crumb,
  current,
  heading,
  pills,
  stat,
}: DetailHeaderProps): React.ReactElement {
  return (
    <div className="shrink-0 border-b border-stone-300 px-6 pt-4 pb-3">
      <nav aria-label="Breadcrumb" className="mb-1.5 text-meta text-stone-600">
        {crumb ? (
          <>
            <Link href={crumb.href} className="text-clay-500 hover:underline">
              {crumb.label}
            </Link>{' '}
            <span aria-hidden="true">/</span>{' '}
          </>
        ) : null}
        <span aria-current="page">{current}</span>
      </nav>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2.5">
          <h1 className="display-heading text-[23px] break-words text-stone-900">{heading}</h1>
          {pills}
        </div>
        {stat ? <p className="text-sm text-stone-600">{stat}</p> : null}
      </div>
    </div>
  );
}

/**
 * Pattern B's two columns: the record on the left, identity and actions in a
 * fixed 320px column on the right — the only place anything that changes state
 * may sit. Below `lg` the aside stacks under the record.
 */
export function DetailGrid({
  record,
  aside,
}: {
  record: ReactNode;
  aside: ReactNode;
}): React.ReactElement {
  return (
    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 pt-4 pb-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-3.5">{record}</div>
      <div data-detail-aside className="flex min-w-0 flex-col gap-3.5">
        {aside}
      </div>
    </div>
  );
}

export interface AdminCardProps {
  title: ReactNode;
  /** The header band's right-hand note — a count, a scope, a warning. */
  note?: ReactNode;
  /**
   * `clay` is the card that moves money: clay edge, clay band. Everything else
   * is `stone`.
   */
  tone?: 'stone' | 'clay';
  /**
   * Declares the card holds data and no controls. It is an attribute rather
   * than a comment so a test can query every read-only card for interactive
   * descendants instead of naming today's controls.
   */
  readOnly?: boolean;
  className?: string;
  children: ReactNode;
}

/** The `.ac` card and its `.ach` header band: 12px radius, `stone-100` band, `stone-300` rule. */
export function AdminCard({
  title,
  note,
  tone = 'stone',
  readOnly = false,
  className,
  children,
}: AdminCardProps): React.ReactElement {
  return (
    <section
      data-admin-card
      data-read-only={readOnly ? '' : undefined}
      className={cn(
        'overflow-hidden rounded-panel border bg-stone-0',
        tone === 'clay' ? 'border-clay-200' : 'border-stone-300',
        className,
      )}
    >
      <div
        data-card-band
        className={cn(
          'flex items-center justify-between gap-2.5 border-b px-4 py-2.5',
          tone === 'clay'
            ? 'border-clay-200 bg-clay-100 text-clay-600'
            : 'border-stone-300 bg-stone-100 text-stone-600',
        )}
      >
        <h2 className="text-label font-semibold tracking-label uppercase">{title}</h2>
        {note ? <div className="text-right text-xs">{note}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** The steel chip a band note is drawn in when it states a scope, `Read-only — …`. */
export function ScopeChip({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <span className="inline-block rounded-[5px] bg-steel-50 px-2 py-[3px] text-steel-600">
      {children}
    </span>
  );
}

/** The `.kv` grid: a fixed 150px label column beside a `minmax(0,1fr)` value. */
export function KeyValueList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <dl
      className={cn(
        'grid grid-cols-[150px_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.5 px-4 py-3',
        className,
      )}
    >
      {children}
    </dl>
  );
}

/** A value an operator would paste: an identifier, a date, an amount. */
export type ValueKind = 'text' | 'mono';

/**
 * One row. Labels are `.k` — 10.5px uppercase 600 `stone-600`; values are 13px
 * `stone-900`, or mono 12px for identifiers, dates and money. Values wrap
 * anywhere and never truncate: a clipped Stripe id is a call to support.
 */
export function KeyValue({
  label,
  kind = 'text',
  children,
}: {
  label: string;
  kind?: ValueKind;
  children: ReactNode;
}): React.ReactElement {
  return (
    <>
      <dt className="pt-0.5 text-label font-semibold tracking-label text-stone-600 uppercase">
        {label}
      </dt>
      <dd
        data-kind={kind}
        className={cn(
          'min-w-0 text-stone-900 [overflow-wrap:anywhere]',
          kind === 'mono' ? 'font-mono text-meta' : 'text-action',
        )}
      >
        {children}
      </dd>
    </>
  );
}

/** The absent value: an em dash in `stone-600`, which is the contrast floor rather than the bundle's `.dz`. */
export function Absent({ children = '—' }: { children?: ReactNode }): React.ReactElement {
  return <span className="font-sans text-action text-stone-600">{children}</span>;
}
