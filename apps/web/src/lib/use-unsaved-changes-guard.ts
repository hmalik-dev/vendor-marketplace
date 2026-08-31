'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Stops unsaved work from vanishing when the vendor navigates away.
 *
 * #227: editing a field showed `Unsaved changes` in the submit bar, and then a
 * click on a section-rail link discarded the edit with no prompt of any kind —
 * no `beforeunload`, no in-app guard. The indicator said the work existed; the
 * navigation said it did not matter.
 *
 * There are **three** exits. Two are covered here and the third is not:
 *
 * - **Leaving the site** — a closed tab, a typed URL, a reload. Only
 *   `beforeunload` reaches this, and the browser draws its own dialog; the
 *   string is ignored by every current browser, so none is invented here.
 * - **Leaving the page inside the app** — a `<Link>` or an `<a>`. The browser
 *   knows nothing about it. This intercepts the click during the capture phase,
 *   before the router sees it, and hands the destination back so the caller can
 *   ask with the product's own dialog rather than a native `confirm`.
 * - **Back and Forward — not covered.** `beforeunload` does not fire for a
 *   same-document history navigation, and the App Router exposes no supported
 *   way to block one: `popstate` arrives *after* the entry has changed, so the
 *   only "fix" is to push a decoy entry and undo it, which corrupts the history
 *   stack the user is trying to walk. Left uncovered deliberately rather than
 *   half-covered, and filed as **#349** so it is a known gap rather than a
 *   silent one. A vendor who presses Back on a dirty form still loses the edit.
 *
 * The interception is deliberately narrow: a modified click (new tab), an
 * external origin, an explicit `target`, and a download all pass straight
 * through, because none of them destroys what is on screen.
 */
export interface UnsavedChangesGuard {
  /** Where the blocked click was heading, or `null` when nothing is pending. */
  pendingHref: string | null;
  /** Abandon the edits and follow the blocked link. */
  confirmLeave: () => void;
  /** Stay on the page. */
  cancelLeave: () => void;
}

export interface UnsavedChangesGuardOptions {
  /**
   * Performs the navigation the guard held back. Defaults to a full assignment,
   * which is correct for every in-app destination and needs no router.
   */
  navigate?: (href: string) => void;
}

/** Whether this click would destroy on-screen work if it were allowed. */
function isDestructiveClick(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }

  // A modified click opens elsewhere and leaves this page standing.
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

function anchorFrom(event: MouseEvent): HTMLAnchorElement | null {
  const target = event.target;

  if (!(target instanceof Element)) {
    return null;
  }

  const anchor = target.closest('a');

  if (!(anchor instanceof HTMLAnchorElement) || anchor.href === '') {
    return null;
  }

  if (anchor.target !== '' && anchor.target !== '_self') {
    return null;
  }

  if (anchor.hasAttribute('download')) {
    return null;
  }

  if (anchor.origin !== window.location.origin) {
    return null;
  }

  // A jump within the page changes nothing about the form.
  if (anchor.pathname === window.location.pathname && anchor.hash !== '') {
    return null;
  }

  return anchor;
}

export function useUnsavedChangesGuard(
  isDirty: boolean,
  options: UnsavedChangesGuardOptions = {},
): UnsavedChangesGuard {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const navigate = options.navigate;

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    function warnBeforeUnload(event: BeforeUnloadEvent): void {
      // `preventDefault` is the modern signal; `returnValue` is what older
      // engines still read. Both are needed for the dialog to appear at all.
      event.preventDefault();
      event.returnValue = '';
    }

    function interceptNavigation(event: MouseEvent): void {
      if (!isDestructiveClick(event)) {
        return;
      }

      const anchor = anchorFrom(event);

      if (!anchor) {
        return;
      }

      /*
       * Capture phase and `stopPropagation`, so the router's own listener never
       * runs. Preventing the default alone is not enough: Next's `<Link>`
       * navigates from its React handler, which does not consult it.
       */
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${anchor.pathname}${anchor.search}${anchor.hash}`);
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    document.addEventListener('click', interceptNavigation, true);

    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      document.removeEventListener('click', interceptNavigation, true);
    };
  }, [isDirty]);

  const confirmLeave = useCallback(() => {
    if (pendingHref === null) {
      return;
    }

    const href = pendingHref;
    setPendingHref(null);

    if (navigate) {
      navigate(href);
      return;
    }

    window.location.assign(href);
  }, [navigate, pendingHref]);

  const cancelLeave = useCallback(() => {
    setPendingHref(null);
  }, []);

  return { pendingHref, confirmLeave, cancelLeave };
}
