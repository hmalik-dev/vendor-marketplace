'use client';

import {
  createTagSuggestionSchema,
  tagSuggestionResponseSchema,
  type TagCategory,
} from '@vendor-marketplace/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { userFacingError } from '@/lib/user-facing-error';
import { TAG_CATEGORY_NOUN } from './tag-display';
import { useApi } from '@/lib/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WireTag } from '@/lib/wire-schemas';

export interface TagSuggestionFormProps {
  category: TagCategory;
  /** The full active list, used for the optimistic client-side dedup pass. */
  allTags: readonly WireTag[];
  /**
   * Called when a suggestion resolved to a tag the vendor should now hold.
   * Returns whether the tag ended up selected — the per-category ceiling can
   * refuse it, and this form must not then claim it was selected (#405).
   */
  onTagResolved: (tag: WireTag) => boolean;
}

/** The comparison key both dedup layers use; mirrors `normalizeTagName`. */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Lets a vendor propose a tag that is not on the list yet.
 *
 * Dedup runs twice on purpose. The client checks the list it already has so an
 * obvious duplicate resolves instantly without a round trip; the server is
 * still authoritative, because the client's list cannot see tags added since
 * the page loaded or suggestions already awaiting review.
 */
export function TagSuggestionForm({
  category,
  allTags,
  onTagResolved,
}: TagSuggestionFormProps): React.ReactElement {
  const request = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputId = `suggest-${category}`;

  const close = (): void => {
    setIsOpen(false);
    setName('');
  };

  /**
   * Reports what actually happened to a suggestion that turned out to be an
   * existing tag.
   *
   * #405: this always said "we've selected X for you". At the per-category
   * ceiling the picker refuses the selection and toasts the limit, so the
   * vendor got two contradictory toasts and a tag that was not selected. The
   * picker owns the refusal message, so this stays quiet and leaves the panel
   * open when the answer is no — closing it would hide the control the vendor
   * has to use to make room.
   */
  const announce = (tag: WireTag): void => {
    if (!onTagResolved(tag)) {
      return;
    }

    toast.success(`Already available — we've selected ${tag.name} for you.`);
    close();
  };

  const submit = async (): Promise<void> => {
    const parsed = createTagSuggestionSchema.safeParse({ suggestedName: name, category });
    if (!parsed.success) {
      toast.error('Enter a tag name of at least two characters.');
      return;
    }

    const alreadyListed = allTags.find(
      (tag) => tag.category === category && normalize(tag.name) === normalize(name),
    );
    if (alreadyListed) {
      announce(alreadyListed);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await request('/tags/suggest', {
        method: 'POST',
        body: parsed.data,
        schema: tagSuggestionResponseSchema,
      });

      if (result.status === 'exists') {
        announce(result.tag);
        return;
      }

      if (result.status === 'already_suggested') {
        toast.info('Already submitted for review.');
      } else {
        toast.success("Submitted for review — we'll notify you when it's approved.");
      }

      close();
    } catch (error) {
      toast.error(userFacingError(error, 'Could not submit that suggestion.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-11 justify-self-start px-0 text-stone-600 sm:h-7"
        onClick={() => setIsOpen(true)}
      >
        Don&apos;t see yours?
      </Button>
    );
  }

  /*
   * Deliberately not a <form>: this sits inside the profile form, and HTML has
   * no nested forms — the browser drops the inner one, which turned this
   * button into a submit for the whole profile. Enter is wired up by hand so
   * the field still behaves like one.
   */
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1">
        <Label htmlFor={inputId} className="text-xs text-stone-600">
          Suggest a {TAG_CATEGORY_NOUN[category]}
        </Label>
        <Input
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="e.g. Amharic"
          className="mt-1"
          autoFocus
        />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={() => void submit()}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Submitting…' : 'Submit for review'}
      </Button>
      <Button type="button" variant="ghost" size="lg" onClick={close} disabled={isSubmitting}>
        Cancel
      </Button>
    </div>
  );
}
