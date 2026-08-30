'use client';

import { useQueryState } from 'nuqs';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
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
 *
 * **The tablist is a roving tabstop**, which is what the `tablist` role
 * promises and what a keyboard user gets everywhere else this pattern appears.
 * Tab enters the row once and lands on the selected tab; the arrows move
 * between them and select as they go. Five separate tabstops — which is what
 * shipped — makes the row cost five presses to walk past and contradicts the
 * role the markup already claimed.
 */
export function ProfileTabs({ panes }: ProfileTabsProps): React.ReactElement {
  const [raw, setTab] = useQueryState('tab', { defaultValue: 'about', clearOnDefault: true });
  const active: ProfileTab = isTab(raw) ? raw : 'about';
  const tabRefs = useRef<Partial<Record<ProfileTab, HTMLButtonElement | null>>>({});

  function focusTab(tab: ProfileTab): void {
    void setTab(tab);
    // Selection follows focus, so the button has to actually take focus —
    // otherwise the arrows change the panel while the ring stays behind.
    tabRefs.current[tab]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const index = PROFILE_TABS.indexOf(active);
    let next: ProfileTab | undefined;

    switch (event.key) {
      case 'ArrowRight':
        next = PROFILE_TABS[(index + 1) % PROFILE_TABS.length];
        break;
      case 'ArrowLeft':
        next = PROFILE_TABS[(index - 1 + PROFILE_TABS.length) % PROFILE_TABS.length];
        break;
      case 'Home':
        next = PROFILE_TABS[0];
        break;
      case 'End':
        next = PROFILE_TABS[PROFILE_TABS.length - 1];
        break;
      default:
        return;
    }

    if (next) {
      // Only for keys this actually handles — an unconditional prevent would
      // swallow Page Down and the browser's own find.
      event.preventDefault();
      focusTab(next);
    }
  }

  return (
    <>
      {/*
        The five tabs total 394px of text at 390, so the last one hung 4px past
        the viewport and took the whole page into horizontal scroll with it. The
        row scrolls on its own below `sm` instead — every tab stays reachable,
        and the page does not move sideways. `30-responsive.md` wants these to
        become anchored sections with a scroll-spy below 1280; that is a larger
        change and #306 owns the threshold ruling.
      */}
      <div
        role="tablist"
        aria-label="Vendor profile sections"
        className="flex gap-5 overflow-x-auto border-b border-stone-300 [scrollbar-width:none] sm:gap-6.5 [&::-webkit-scrollbar]:hidden"
      >
        {PROFILE_TABS.map((tab) => (
          <button
            key={tab}
            ref={(node) => {
              tabRefs.current[tab] = node;
            }}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-selected={active === tab}
            aria-controls={`panel-${tab}`}
            tabIndex={active === tab ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => void setTab(tab)}
            className={cn(
              /*
                The ring is drawn INSIDE the button — `outline-offset` is
                negative — because the row is a scroll container and a scroll
                container clips on both axes whatever CSS says about
                `overflow-y`. An outward ring on the first or last tab was
                sliced down its outer edge, which is the one place a keyboard
                user most needs to see where they are.
              */
              'shrink-0 cursor-pointer py-2.5 text-[13.5px] whitespace-nowrap transition-colors duration-(--duration-fast) outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-clay-400',
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
        className="pt-4.5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-400"
      >
        {panes[active]}
      </div>
    </>
  );
}
