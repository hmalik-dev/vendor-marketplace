'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface FormSection {
  /** Matches the `id` on the section element. */
  id: string;
  label: string;
  /** A gold dot marks a section holding something back from publishing. */
  blocks: boolean;
}

export interface FormSectionNavProps {
  sections: readonly FormSection[];
  className?: string;
}

/**
 * The sticky section nav that multi-section forms carry at >=1280px. It doubles
 * as a completion indicator, so a vendor can see both *what* is blocking
 * publication and *where* to fix it without scrolling the form looking for it.
 */
export function FormSectionNav({ sections, className }: FormSectionNavProps): React.ReactElement {
  const [activeId, setActiveId] = useState<string | undefined>(sections[0]?.id);

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
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
  }, [sections]);

  const remaining = sections.filter((section) => section.blocks).length;

  return (
    <nav aria-label="Form sections" className={className}>
      <ul className="space-y-1">
        {sections.map((section) => {
          const isActive = section.id === activeId;

          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-(--duration-fast)',
                  isActive
                    ? 'bg-clay-100 font-medium text-clay-600'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-800',
                )}
              >
                {section.label}
                {section.blocks ? (
                  <span
                    aria-label="Needs attention before publishing"
                    className="size-2 shrink-0 rounded-full bg-gold-400"
                  />
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 border-t border-stone-300 px-3 pt-4 text-xs text-stone-600">
        {remaining === 0
          ? 'Everything needed to publish is filled in.'
          : `${remaining} ${remaining === 1 ? 'section needs' : 'sections need'} attention before publishing.`}
      </p>
    </nav>
  );
}
