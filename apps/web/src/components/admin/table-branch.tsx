'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

/**
 * Tailwind's `md`, as a media query. `DataTable` draws the grid at and above
 * it and the card list below it, and its `hidden md:block` / `md:hidden`
 * classes name the same boundary.
 */
const BELOW_MD = '(width < 48rem)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(BELOW_MD);
  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

function belowMd(): boolean {
  return window.matchMedia(BELOW_MD).matches;
}

/** The server cannot know the width, so it answers "unknown" and draws both. */
function unknownWidth(): null {
  return null;
}

/**
 * Mounts one of `DataTable`'s two branches only at the widths it is for (VEN-395).
 *
 * Both branches used to stay in the DOM with CSS picking one, so every row
 * control existed twice under the same accessible name — `Actions for <vendor>`
 * resolved to two buttons and every `getByRole` on the table was ambiguous.
 * That is the DOM `.claude/rules/web-design-parity.md`'s Tab-order note warns
 * about, and this is its fix: **one cause, the two symptoms**.
 *
 * Not fixed by renaming one copy: two controls doing the same thing to the same
 * row must not carry different names. And not a width read in an effect: the
 * server render still draws both branches, gated by their breakpoint classes, so
 * the first paint is right at every width with no flash. Hydration then unmounts
 * the branch the viewport is not using, and a resize swaps them.
 */
export function TableBranch({
  cards,
  children,
}: {
  /** `true` for the card list, which mounts below `md`; the grid mounts at and above it. */
  cards: boolean;
  children: ReactNode;
}): ReactNode {
  const narrow = useSyncExternalStore(subscribe, belowMd, unknownWidth);

  return narrow === null || narrow === cards ? children : null;
}
