'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export interface FormSection {
  /** Matches the `id` on the section element, or the route for a link item. */
  id: string;
  label: string;
  /** A gold dot marks a section holding something back from publishing. */
  blocks: boolean;
  /**
   * Set when the section lives on its own surface rather than in this form.
   * The storefront is one checklist even though it spans several routes.
   */
  href?: string;
}

export interface FormSectionNavProps {
  sections: readonly FormSection[];
  className?: string;
}

/**
 * The storefront's section rail. It doubles as a completion indicator, so a
 * vendor can see both *what* is blocking publication and *where* to fix it
 * without scrolling the form looking for it — the same blocker appears in the
 * field, here, and in the submit bar at once.
 *
 * See design/design-plan/17-vendor-profile-editor.md.
 */
export function FormSectionNav({ sections, className }: FormSectionNavProps): React.ReactElement {
  const anchorIds = useMemo(
    () => sections.filter((section) => section.href === undefined).map((section) => section.id),
    [sections],
  );
  const [activeId, setActiveId] = useState<string | undefined>(anchorIds[0]);

  useEffect(() => {
    const elements = anchorIds
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) {
      return;
    }

    // The band starts below the sticky header and ends above the submit bar, so
    // the highlighted item is the section actually under the reader's eye
    // rather than whichever one happens to touch the viewport edge.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);

        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: 0 },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
    // Keyed on the ids rather than the section objects: the parent rebuilds
    // those every render as blockers clear, and re-observing on each keystroke
    // would tear the observer down mid-scroll.
  }, [anchorIds]);

  const hasBlockers = sections.some((section) => section.blocks);

  return (
    <nav aria-label="Storefront sections" className={cn('flex flex-col gap-1 p-3 pt-4', className)}>
      {sections.map((section) => {
        const isActive = section.href === undefined && section.id === activeId;
        const content = (
          <>
            {section.label}
            {section.blocks ? (
              <span
                aria-label="Needs attention before publishing"
                role="img"
                className="ml-auto size-1.75 shrink-0 rounded-full bg-gold-400"
              />
            ) : null}
          </>
        );
        const classes = cn(
          'flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-base font-medium transition-colors duration-(--duration-fast)',
          isActive
            ? 'bg-clay-100 font-semibold text-clay-600 shadow-[inset_3px_0_0_var(--color-clay-400)]'
            : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900',
        );

        return section.href !== undefined ? (
          <Link key={section.id} href={section.href} className={classes}>
            {content}
          </Link>
        ) : (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={isActive ? 'true' : undefined}
            className={classes}
          >
            {content}
          </a>
        );
      })}

      {/* The legend the dots are read against, kept at the foot of the rail. */}
      <p className="mt-auto flex items-center gap-1.5 px-3 pt-4 pb-1 text-xs leading-normal text-stone-600">
        {hasBlockers ? (
          <>
            <span aria-hidden="true" className="size-1.75 shrink-0 rounded-full bg-gold-400" />
            Gold dots block publishing
          </>
        ) : (
          'Everything needed to publish is filled in.'
        )}
      </p>
    </nav>
  );
}
