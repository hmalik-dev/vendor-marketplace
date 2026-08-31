'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MAX_ADMIN_NOTE_LENGTH } from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import { TAG_CATEGORY_LABELS } from '@/components/tags/tag-display';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill, type StatusTone } from '@/components/ui/status-pill';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
import {
  wireAdminTagSuggestionResultSchema,
  type WireAdminTagRow,
  type WireAdminTagSuggestionRow,
} from '@/lib/wire-schemas';

const SUGGESTED = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const STATUS_TONES: Record<string, StatusTone> = {
  pending: 'pending',
  approved: 'confirmed',
  rejected: 'inert',
};

export interface TagQueueProps {
  suggestions: readonly WireAdminTagSuggestionRow[];
  /** The live vocabulary, so `Merge` can only ever pick a tag that exists. */
  tags: readonly WireAdminTagRow[];
  /** `pending` shows the actions; the history views are read-only. */
  showActions: boolean;
}

/**
 * The suggestion queue: approve, reject with a note, or merge into an existing
 * tag.
 *
 * A card list rather than a table. Each decision needs the vendor's wording,
 * the category, a reason field and three actions — which is a form, and a 44px
 * table row is not where a form goes.
 */
export function TagQueue({ suggestions, tags, showActions }: TagQueueProps): React.ReactElement {
  if (suggestions.length === 0) {
    return (
      <EmptyState
        panel
        headline="Nothing waiting"
        description="Vendors suggest a tag when the list does not describe them. Approved tags become search filters, so the queue is worth keeping short."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {suggestions.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          tags={tags}
          showActions={showActions}
        />
      ))}
    </ul>
  );
}

function SuggestionCard({
  suggestion,
  tags,
  showActions,
}: {
  suggestion: WireAdminTagSuggestionRow;
  tags: readonly WireAdminTagRow[];
  showActions: boolean;
}): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [note, setNote] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * Only **active** tags in the suggestion's own category.
   *
   * The API refuses a cross-category merge, so offering one would be a control
   * that exists to be rejected. `isActive` is the subtler half: a deactivated
   * tag is hidden from the picker and from search filters, so merging into one
   * would close the suggestion by giving the vendor a tag nobody can see.
   */
  const mergeable = tags.filter((tag) => tag.category === suggestion.category && tag.isActive);

  async function resolve(body: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await call(`/admin/tag-suggestions/${suggestion.id}`, {
        method: 'PUT',
        body,
        schema: wireAdminTagSuggestionResultSchema,
      });
      router.refresh();
    } catch (failure) {
      // `userFacingError`, not `failure.message` — the same reason
      // `ConfirmAction` uses it: a 5xx body is written about the server.
      setError(
        userFacingError(failure, 'That did not reach us. Check your connection and try again.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-stone-300 bg-stone-0 p-4">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="font-display text-display-sm text-stone-900">
          {suggestion.suggestedName}
        </span>
        <StatusPill tone={STATUS_TONES[suggestion.status] ?? 'inert'}>
          {suggestion.status}
        </StatusPill>
        <span className="text-meta text-stone-600">
          {TAG_CATEGORY_LABELS[suggestion.category]} · suggested by {suggestion.vendorName} ·{' '}
          {SUGGESTED.format(suggestion.createdAt)}
        </span>
      </div>

      {suggestion.resolvedTagName ? (
        <p className="mt-2 text-sm text-stone-600">
          Resolved to{' '}
          <span className="font-semibold text-stone-900">{suggestion.resolvedTagName}</span>.
        </p>
      ) : null}
      {suggestion.adminNote ? (
        <p className="mt-1 text-sm text-stone-600">Note: {suggestion.adminNote}</p>
      ) : null}

      {showActions ? (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-2.5">
            <label className="flex min-w-64 flex-1 flex-col gap-1">
              <span className="text-label font-semibold tracking-label text-stone-600 uppercase">
                Note
              </span>
              <input
                type="text"
                value={note}
                maxLength={MAX_ADMIN_NOTE_LENGTH}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Required to reject — why this one was turned down"
                className="rounded-lg border border-stone-300 bg-stone-0 px-3 py-2 text-base text-stone-900 placeholder:text-stone-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-400"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-label font-semibold tracking-label text-stone-600 uppercase">
                Merge into
              </span>
              <select
                value={mergeTarget}
                onChange={(event) => setMergeTarget(event.target.value)}
                className="rounded-lg border border-stone-300 bg-stone-0 px-3 py-2 text-base text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-400"
              >
                <option value="">An existing tag…</option>
                {mergeable.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <ConfirmAction
              trigger={
                <Button type="button" size="sm" disabled={busy}>
                  Approve
                </Button>
              }
              title={`Approve “${suggestion.suggestedName}”?`}
              description="It becomes a real tag, is added to the suggesting vendor's profile, and starts appearing as a search filter. If the same name already exists, it is merged into that tag instead."
              confirmLabel="Approve tag"
              onConfirm={() => resolve({ action: 'approve', ...(note ? { adminNote: note } : {}) })}
            />

            <ConfirmAction
              trigger={
                <Button type="button" size="sm" variant="secondary" disabled={busy || !mergeTarget}>
                  Merge
                </Button>
              }
              title="Merge into the selected tag?"
              description="The suggestion is closed as approved and the vendor is given the existing tag. No new tag is created."
              confirmLabel="Merge tag"
              onConfirm={() =>
                resolve({
                  action: 'merge',
                  mergeTagId: mergeTarget,
                  ...(note ? { adminNote: note } : {}),
                })
              }
            />

            <ConfirmAction
              destructive
              trigger={
                <Button type="button" size="sm" variant="secondary" disabled={busy || !note.trim()}>
                  Reject
                </Button>
              }
              title={`Reject “${suggestion.suggestedName}”?`}
              description="The note is kept on the queue as the record of why. The vendor is not notified — telling somebody their idea was turned down is how a product stops receiving suggestions."
              confirmLabel="Reject suggestion"
              onConfirm={() => resolve({ action: 'reject', adminNote: note })}
            />
          </div>

          {/* The Reject button is disabled without a note; say so rather than
              leaving a dead control the operator has to guess at. */}
          {note.trim() ? null : (
            <p className="mt-2 text-helper text-stone-600">
              A note is required to reject. Approve and Merge do not need one.
            </p>
          )}

          {error ? (
            <p role="alert" className="mt-2 text-sm text-error-500">
              {error}
            </p>
          ) : null}
        </>
      ) : null}
    </li>
  );
}
