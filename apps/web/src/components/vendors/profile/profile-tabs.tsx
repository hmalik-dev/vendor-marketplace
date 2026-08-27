'use client';

import { useQueryState } from 'nuqs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const PROFILE_TABS = ['about', 'packages', 'portfolio', 'reviews', 'availability'] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

const TAB_LABELS: Record<ProfileTab, string> = {
  about: 'About',
  packages: 'Packages',
  portfolio: 'Portfolio',
  reviews: 'Reviews',
  availability: 'Availability',
};

function isTab(value: string): value is ProfileTab {
  return (PROFILE_TABS as readonly string[]).includes(value);
}

export interface ProfileTabsProps {
  panes: Record<ProfileTab, ReactNode>;
}

/**
 * The five tabs of frame `03`. State lives in `?tab=` rather than in component
 * state so a tab is linkable, survives a reload, and lands back where it was
 * after a back-navigation — a profile is a page people send to each other.
 *
 * An unrecognised `?tab=` falls back to About rather than rendering nothing:
 * the parameter is in a URL anyone can edit.
 */
export function ProfileTabs({ panes }: ProfileTabsProps): React.ReactElement {
  const [raw, setTab] = useQueryState('tab', { defaultValue: 'about', clearOnDefault: true });
  const active: ProfileTab = isTab(raw) ? raw : 'about';

  return (
    <>
      {/*
        The five tabs total 394px of text at 390, so the last one hung 4px past
        the viewport and took the whole page into horizontal scroll with it. The
        row scrolls on its own below `sm` instead — every tab stays reachable,
        and the page does not move sideways. `30-responsive.md` wants these to
        become anchored sections with a scroll-spy below 1280; that is a larger
        change and is recorded on the ticket rather than half-built here.
      */}
      <div
        role="tablist"
        aria-label="Vendor profile sections"
        className="flex gap-5 overflow-x-auto border-b border-stone-300 [scrollbar-width:none] sm:gap-6.5 [&::-webkit-scrollbar]:hidden"
      >
        {PROFILE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-selected={active === tab}
            aria-controls={`panel-${tab}`}
            onClick={() => void setTab(tab)}
            className={cn(
              'shrink-0 cursor-pointer py-2.5 text-[13.5px] whitespace-nowrap transition-colors duration-(--duration-fast)',
              active === tab
                ? 'font-semibold text-stone-900 shadow-[inset_0_-2px_0_var(--color-clay-400)]'
                : 'font-medium text-stone-600 hover:text-stone-900',
            )}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        tabIndex={0}
        className="pt-4.5"
      >
        {panes[active]}
      </div>
    </>
  );
}
