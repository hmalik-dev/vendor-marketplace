import Link from 'next/link';
import { ACCOUNT_SETTINGS_PATH } from '@/components/account/settings-paths';

/**
 * The centered column every settings page sits in (VEN-703). A detail page
 * passes `backLink`; the list itself does not.
 */
export function SettingsLayout({
  title,
  backLink = false,
  children,
}: {
  title: string;
  backLink?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mx-auto w-full max-w-xl px-6 pt-10 pb-16">
      {backLink ? (
        <Link
          href={ACCOUNT_SETTINGS_PATH}
          className="mb-4 inline-block text-sm font-semibold text-stone-600 hover:text-stone-900"
        >
          ← Account settings
        </Link>
      ) : null}
      <h1 className="font-display text-[33px] leading-[1.1] text-stone-900">{title}</h1>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export interface SettingsRowData {
  /** Stable key for the row. */
  id: string;
  label: string;
  /** One line: what the setting is now. */
  value: string;
  href: string;
}

/** One row per setting: a later setting is one more entry in the list the page passes. */
export function SettingsRows({ rows }: { rows: SettingsRowData[] }): React.ReactElement {
  return (
    <ul className="divide-y divide-stone-300 border-y border-stone-300">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={row.href}
            className="flex items-center justify-between gap-4 py-4 hover:bg-stone-50"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-base font-semibold text-stone-900">{row.label}</span>
              <span className="truncate text-sm text-stone-600">{row.value}</span>
            </span>
            <span aria-hidden="true" className="text-stone-500">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
