import Link from 'next/link';
import type { ReactNode } from 'react';

export interface DashboardSection {
  title: string;
  description: string;
  /**
   * Where the section leads. Required: a card that goes nowhere is not drawn.
   * A dashboard is a set of doors, and a door that does not open is furniture.
   */
  href: string;
}

export interface DashboardShellProps {
  eyebrow: string;
  heading: string;
  description: string;
  sections: readonly DashboardSection[];
  children?: ReactNode;
}

/**
 * The frame every dashboard page sits in. Every section is a link to a surface
 * that exists; pages omit the rest rather than drawing a card that does nothing.
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
        <p className="text-label font-semibold tracking-label text-stone-600 uppercase">
          {eyebrow}
        </p>
        {/*
          App page titles cap at display-md. A display-lg heading inside an app
          frame is a bug — see design/design-plan/04-laws.md.
        */}
        <h1 className="mt-2 display-heading text-display-md text-stone-900">{heading}</h1>
        <p className="mt-3 text-base leading-prose text-stone-700">{description}</p>
      </header>

      {children}

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <li key={section.title}>
            <Link
              href={section.href}
              className="block h-full rounded-xl bg-stone-0 p-5 shadow-sm transition-shadow duration-(--duration-base) hover:shadow-hover"
            >
              <h2 className="font-display text-display-sm text-stone-900">{section.title}</h2>
              <p className="mt-2 text-base leading-prose text-stone-700">{section.description}</p>
              <p className="mt-4 text-label font-semibold tracking-label text-clay-500 uppercase">
                Open
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
