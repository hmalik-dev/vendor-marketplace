'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface JumpRailSection {
  number: number;
  title: string;
  id: string;
}

/**
 * The 212px sticky rail beside a legal page's measure — frame `31`.
 *
 * **Rendered only where there is something to jump between.** The caller
 * decides that, against `LEGAL_JUMP_RAIL_MIN_SECTIONS`: `/terms` and `/privacy`
 * carry it, `/cookies` does not and must not draw an empty column beside four
 * paragraphs.
 *
 * The active section is tracked with `IntersectionObserver` rather than scroll
 * arithmetic. Scroll maths has to know the header's height, the sticky offset
 * and the page's own padding, and it is wrong on every one of them the first
 * time any of the three changes.
 */
export function JumpRail({ sections }: { sections: JumpRailSection[] }): React.ReactElement {
  const [active, setActive] = useState(sections[0]?.id ?? '');

  useEffect(() => {
    const headings = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);

    if (headings.length === 0) {
      return;
    }

    /*
     * The band is the top of the reading area, not the whole viewport: with a
     * full-height root margin every heading on screen is "intersecting" at
     * once and the last one observed wins, which makes the rail jump to the
     * bottom of the page on load. `-45% bottom` leaves a strip just under the
     * header, so the active section is the one the reader is actually in.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        const entered = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (entered[0]) {
          setActive(entered[0].target.id);
        }
      },
      { rootMargin: '-88px 0px -45% 0px', threshold: 0 },
    );

    for (const heading of headings) {
      observer.observe(heading);
    }

    return () => {
      observer.disconnect();
    };
  }, [sections]);

  return (
    <nav aria-label="On this page" className="sticky top-24">
      <p className="mb-3.25 text-label font-semibold tracking-label text-stone-600 uppercase">
        On this page
      </p>
      <ul className="flex flex-col border-l border-stone-300">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? 'true' : undefined}
              className={cn(
                'block py-1.75 pl-3.5 text-sm transition-colors duration-(--duration-fast)',
                active === section.id
                  ? 'font-semibold text-clay-500 shadow-[inset_2px_0_0_var(--color-clay-400)]'
                  : 'text-stone-700 hover:text-stone-900',
              )}
            >
              {section.number}&nbsp;&nbsp;{section.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
