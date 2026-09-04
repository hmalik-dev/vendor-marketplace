'use client';

import { MAX_BUSINESS_NAME_LENGTH } from '@vendor-marketplace/shared';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The referral case, and only the referral case: someone was handed a business
 * card or a recommendation and already knows who they want.
 *
 * It is deliberately the smallest affordance on the screen — a plain link, not
 * a field — because putting a text box on the main path is what the redesign
 * removed. Searching by name matches the business name alone; it never becomes
 * a general query over profile copy. See decision D6.
 */
export interface NameSearchProps {
  value: string;
  onSubmit: (name: string) => void;
}

export function NameSearch({ value, onSubmit }: NameSearchProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  // Reopening after a back-navigation shows what is actually being searched.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (next: string): void => {
    onSubmit(next);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger className="shrink-0 text-[12.5px] font-semibold whitespace-nowrap text-clay-500 hover:text-clay-600 hover:underline max-sm:self-start">
        Search by name
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Search by name</DialogTitle>
          <DialogDescription>
            Already know who you want? Type their business name.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            commit(draft.trim());
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vendor-name-search">Business name</Label>
            <Input
              id="vendor-name-search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Kessler &amp; Co."
              autoComplete="off"
              // The API's own cap, so a long paste is refused at the keyboard
              // rather than cleared out from under the customer later.
              maxLength={MAX_BUSINESS_NAME_LENGTH}
            />
          </div>

          <DialogFooter>
            {value !== '' ? (
              <Button type="button" variant="secondary" onClick={() => commit('')}>
                Clear name
              </Button>
            ) : null}
            <Button type="submit" variant="primary">
              Search
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
