'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UnsavedChangesGuard } from '@/lib/use-unsaved-changes-guard';

/**
 * The prompt `useUnsavedChangesGuard` holds a navigation for.
 *
 * The hook is the shared half and always was; its dialog was not, and the
 * second form to need one copied all twenty-odd lines of it — the same drift
 * the hook itself was factored out to prevent. Both forms lose the same thing
 * in the same way, so a second wording would be a second answer to one
 * question.
 *
 * Takes the guard's own return value, so a call site cannot pair one form's
 * `pendingHref` with another's `confirmLeave`.
 *
 * `40-states.md`: leaving is the destructive option and is styled as such;
 * staying is the escape hatch the same section requires.
 */
export function UnsavedChangesDialog({
  guard,
  /** What is being left. "profile" reads as "your changes to this profile". */
  noun = 'profile',
}: {
  guard: UnsavedChangesGuard;
  noun?: string;
}): React.ReactElement {
  const { pendingHref, confirmLeave, cancelLeave } = guard;

  return (
    <Dialog
      open={pendingHref !== null}
      onOpenChange={(open) => {
        if (!open) {
          cancelLeave();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Leave without saving?</DialogTitle>
          <DialogDescription>
            Your changes to this {noun} have not been saved. Leaving now discards them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={cancelLeave}>
            Keep editing
          </Button>
          <Button type="button" variant="destructive" onClick={confirmLeave}>
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
