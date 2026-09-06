'use client';

import { placeSuggestionListSchema, type PlaceSuggestion } from '@vendor-marketplace/shared';
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from './api-client';
import { reportSwallowedError } from './report-error';

/**
 * How long the field waits after the last keystroke before asking.
 *
 * A request per character is what "do not preload" turns into if nobody picks a
 * number: the same list, fetched thirty times instead of once. 180ms is below
 * the ~250ms at which a suggestion list starts to feel detached from typing,
 * and above the interval a person sustains mid-word.
 */
export const PLACE_SUGGESTION_DEBOUNCE_MS = 180;

export interface PlaceSuggestionState {
  suggestions: readonly PlaceSuggestion[];
  /** A request is in flight and there is nothing yet to show for this query. */
  busy: boolean;
  /**
   * The last request failed, as distinct from answering with nothing.
   *
   * Two states the panel must not conflate. "We could not ask" and "no such
   * place" look identical from a caller that only sees an empty array, and
   * `40-states.md` does not let a failure borrow an empty state's copy — a
   * field that says `No US city matches "portl"` while the API is refusing
   * every request is telling the customer they made a typo.
   */
  failed: boolean;
}

const EMPTY: PlaceSuggestionState = { suggestions: [], busy: false, failed: false };

/**
 * The `City` field's suggestions, fetched as the customer types (#384).
 *
 * **Nothing is fetched on mount, and that is the requirement, not an
 * optimisation.** The user's instruction was verbatim *"Do not preload"*; an
 * empty query returns the empty state without touching the network, so the
 * landing page and every page carrying the header ship no city list at all.
 *
 * Three things it does that a bare `useEffect` + `fetch` would not:
 *
 * - **Debounces**, so a typed word costs one request rather than one per letter.
 * - **Aborts the previous request** before starting the next. Without it two
 *   answers race and the slower one wins, which renders `Aus` results under the
 *   word `Austin` — the classic typeahead defect, and the reason the effect
 *   cleans up rather than merely ignoring a late answer.
 * - **Remembers what it has already been told**, so backspacing through a word
 *   is free and shows its rows immediately rather than blanking and re-asking.
 *   Bounded, because a session that types for an hour should not accumulate a
 *   response per prefix.
 *
 * A failed request yields **no suggestions and `failed`**, never a thrown
 * error. The flag is not decoration: without it the panel says `No US city
 * matches "portl"` while the API is refusing every request, which accuses the
 * customer of a typo for a place with eight matches. The committed value — the
 * only thing that reaches the search — is untouched either way.
 */
export function usePlaceSuggestions(query: string): PlaceSuggestionState {
  const needle = query.trim();
  const cache = useRef<Map<string, readonly PlaceSuggestion[]>>(new Map());
  const [state, setState] = useState<PlaceSuggestionState>(EMPTY);

  useEffect(() => {
    if (needle === '') {
      setState(EMPTY);
      return;
    }

    const cached = cache.current.get(needle);
    if (cached !== undefined) {
      setState({ suggestions: cached, busy: false, failed: false });
      return;
    }

    /*
     * The previous query's rows stay on screen while this one loads, so the
     * panel does not flash empty between two matching words. `busy` is what
     * tells the panel to say "Searching…" rather than "no such place" for the
     * rows it is still showing.
     */
    setState((held) => ({ suggestions: held.suggestions, busy: true, failed: false }));

    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const suggestions = await apiRequest(`/places?q=${encodeURIComponent(needle)}`, {
            schema: placeSuggestionListSchema,
            token: null,
            signal: controller.signal,
          });

          /*
           * The catch checks this too. Here it closes the window between the
           * request settling and this continuation running: an answer that
           * arrives just as the effect is torn down must neither render nor be
           * cached, or a query nobody is asking about is remembered as current.
           */
          if (controller.signal.aborted) {
            return;
          }

          remember(cache.current, needle, suggestions);
          setState({ suggestions, busy: false, failed: false });
        } catch (error) {
          /*
           * The abort lands here too, and it must change nothing: the query it
           * belonged to is one nobody is asking about any more, and writing an
           * emptier list for it would overwrite the newer one.
           * `reportSwallowedError` filters aborts itself, which is why the
           * trace and the state guard read the same condition twice.
           */
          if (!controller.signal.aborted) {
            reportSwallowedError('city typeahead: /places request failed', error);
            setState({ suggestions: [], busy: false, failed: true });
          }
        }
      })();
    }, PLACE_SUGGESTION_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [needle]);

  return state;
}

/** Oldest-first eviction; `Map` preserves insertion order, so the first key is it. */
const CACHE_LIMIT = 50;

function remember(
  cache: Map<string, readonly PlaceSuggestion[]>,
  key: string,
  value: readonly PlaceSuggestion[],
): void {
  cache.set(key, value);

  // One insert can put it over by at most one, so this is an `if`, not a loop.
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
}
