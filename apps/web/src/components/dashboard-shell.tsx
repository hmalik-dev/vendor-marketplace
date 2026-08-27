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
        <p className="text-[10.5px] font-semibold tracking-[.05em] text-stone-600 uppercase">
          {eyebrow}
        </p>
        {/*
          App page titles cap at display-md. A display-lg heading inside an app
          frame is a bug — see design/design-plan/04-laws.md.
        */}
        <h1 className="mt-2 font-display text-display-md text-stone-900">{heading}</h1>
        <p className="mt-3 text-base text-stone-700">{description}</p>
      </header>

      {children}

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const body = (
            <>
              <h2 className="font-display text-display-sm text-stone-900">{section.title}</h2>
              <p className="mt-2 text-base text-stone-700">{section.description}</p>
              <p className="mt-4 text-[10.5px] font-semibold tracking-[.05em] text-clay-500 uppercase">
                {section.href ? 'Open' : section.arrivesIn}
              </p>
            </>
          );

          return (
            <li key={section.title}>
              {section.href ? (
                <Link
                  href={section.href}
                  className="block h-full rounded-xl bg-stone-0 p-5 shadow-sm transition-shadow duration-(--duration-base) hover:shadow-hover"
                >
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-xl bg-stone-0 p-5 shadow-sm">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
