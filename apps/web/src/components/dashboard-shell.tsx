import Link from 'next/link';
import type { ReactNode } from 'react';

export interface DashboardSection {
  title: string;
  description: string;
  /** Where the section lives, once the surface exists. */
  href?: string;
  /** Ticket that will replace the placeholder with the real surface. */
  arrivesIn?: string;
}

export interface DashboardShellProps {
  eyebrow: string;
  heading: string;
  description: string;
  sections: readonly DashboardSection[];
  children?: ReactNode;
}

/**
 * The frame every dashboard page sits in. Ticket #2 delivers the shell and the
 * routing around it; each section below is filled in by the ticket named on it.
 */
export function DashboardShell({
  eyebrow,
  heading,
  description,
  sections,
  children,
}: DashboardShellProps): React.ReactElement {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-sm font-medium tracking-wide text-primary-600 uppercase">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-stone-800 sm:text-4xl">
          {heading}
        </h1>
        <p className="mt-3 text-stone-600">{description}</p>
      </header>

      {children}

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const body = (
            <>
              <h2 className="font-display text-lg font-semibold text-stone-800">{section.title}</h2>
              <p className="mt-2 text-sm text-stone-600">{section.description}</p>
              <p className="mt-4 text-xs font-medium tracking-wide text-primary-600 uppercase">
                {section.href ? 'Open' : section.arrivesIn}
              </p>
            </>
          );

          return (
            <li key={section.title}>
              {section.href ? (
                <Link
                  href={section.href}
                  className="block h-full rounded-lg border border-stone-150 bg-card p-5 shadow-sm transition-colors duration-(--duration-fast) hover:border-primary-400 hover:bg-primary-50"
                >
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-lg border border-stone-150 bg-card p-5 shadow-sm">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
