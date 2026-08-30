'use client';

import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_CAPTION_LENGTH,
  UPLOAD_CONSTRAINT_LINE,
} from '@vendor-marketplace/shared';
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiClientError } from '@/lib/api-client';
import { moveItem } from '@/lib/reorder';
import { useApi } from '@/lib/use-api';
import { useUploadQueue } from '@/lib/use-upload-queue';
import { aggregateLine, failureSentence, retryableTasks } from '@/lib/uploads';
import { cn } from '@/lib/utils';
import { wirePortfolioItemSchema, wirePortfolioListSchema } from '@/lib/wire-schemas';
import type { WirePortfolioItem } from '@/lib/wire-schemas';
import { UploadTile } from '@/components/uploads/upload-tile';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, INPUT_TOUCH_HEIGHT } from '@/components/ui/input';

const ACCEPT = ACCEPTED_IMAGE_MIME_TYPES.join(',');

export interface PortfolioManagerProps {
  initialItems: readonly WirePortfolioItem[];
}

/**
 * The vendor's gallery: upload, caption, reorder, remove. Photos are stored the
 * moment they are chosen rather than staged behind a save, because an upload is
 * the slow part and a vendor adding eight photos should not wait for a batch.
 */
export function PortfolioManager({ initialItems }: PortfolioManagerProps): React.ReactElement {
  const request = useApi();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<readonly WirePortfolioItem[]>(initialItems);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<WirePortfolioItem | null>(null);

  /*
   * Each finished upload is saved on its own, so a failure never rolls back a
   * sibling — partial success is the normal case, not an edge case. The photo
   * joins the gallery the moment its row exists rather than after the batch,
   * which is what lets the vendor leave the page mid-upload.
   */
  const persist = useCallback(
    async (stored: { imageKey: string; thumbnailKey: string | null }): Promise<void> => {
      const created = await request('/vendor/portfolio', {
        method: 'POST',
        // The key is persisted; the URL is built at the render boundary.
        body: { imageUrl: stored.imageKey, thumbnailUrl: stored.thumbnailKey },
        schema: wirePortfolioItemSchema,
      });

      setItems((previous) => [...previous, created]);
    },
    [request],
  );

  const queue = useUploadQueue({ prefix: 'portfolio', onUploaded: persist });

  const inFlight = queue.tasks.filter((task) => task.status !== 'done');
  const progressLine = aggregateLine(queue.tasks);
  const failures = failureSentence(queue.tasks);
  const canRetry = retryableTasks(queue.tasks).length > 0;

  const saveCaption = async (item: WirePortfolioItem, caption: string): Promise<void> => {
    const next = caption.trim();
    if (next === (item.caption ?? '')) {
      return;
    }

    try {
      const saved = await request(`/vendor/portfolio/${item.id}`, {
        method: 'PATCH',
        body: { caption: next },
        schema: wirePortfolioItemSchema,
      });

      setItems((previous) => previous.map((row) => (row.id === saved.id ? saved : row)));
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not save that caption.');
    }
  };

  const remove = async (item: WirePortfolioItem): Promise<void> => {
    setIsBusy(true);
    try {
      await request(`/vendor/portfolio/${item.id}`, {
        method: 'DELETE',
        // A 204 carries no body, which the client hands back as `null`.
        schema: z.null(),
      });

      setItems((previous) => previous.filter((row) => row.id !== item.id));
      toast.success('Photo removed.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not remove that photo.');
    } finally {
      setIsBusy(false);
      setPendingRemoval(null);
    }
  };

  const persistOrder = async (next: readonly WirePortfolioItem[]): Promise<void> => {
    const previous = items;
    setItems(next);
    setIsBusy(true);

    try {
      const saved = await request('/vendor/portfolio/reorder', {
        method: 'PUT',
        body: { itemIds: next.map((row) => row.id) },
        schema: wirePortfolioListSchema,
      });
      setItems(saved);
    } catch (error) {
      setItems(previous);
      toast.error(
        error instanceof ApiClientError ? error.message : 'Could not save the new order.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const move = (from: number, to: number): void => {
    if (from === to || to < 0 || to >= items.length) {
      return;
    }
    void persistOrder(moveItem(items, from, to));
  };

  return (
    <>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          // A card being dragged within the grid is a reorder, not an upload.
          if (draggingId === null) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (draggingId === null) {
            queue.addFiles([...event.dataTransfer.files]);
          }
        }}
        className={cn(
          'rounded-lg border-2 border-dashed p-4 transition-colors duration-(--duration-fast)',
          isDragging ? 'border-clay-400 bg-clay-100' : 'border-stone-200 bg-card',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-stone-600">Drag photos here, or choose them.</p>
            {/*
              The constraint line, stated before the picker opens and in the
              same words as the requirements rail — `40-states.md` requires it
              in both places, so both read the one constant.
            */}
            <p className="mt-0.5 text-xs text-stone-600">{UPLOAD_CONSTRAINT_LINE}</p>
          </div>
          <div className="flex items-center gap-3">
            {/*
              The compact count in the header. It turns red when something has
              failed rather than adding a second alert beside the banner.
            */}
            {inFlight.length > 0 ? (
              <span
                className={cn(
                  'text-sm font-medium',
                  failures ? 'text-error-500' : 'text-steel-600',
                )}
              >
                {inFlight.length} in progress
              </span>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="h-11 lg:h-8"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus aria-hidden="true" />
              Add photos
            </Button>
          </div>
        </div>

        {/* One aggregate line for the batch, in steel — never a second spinner. */}
        {progressLine ? (
          <div className="mt-3 flex items-center gap-2.5">
            <p role="status" className="text-sm text-steel-600">
              {progressLine}
            </p>
            {/*
              Frame `24` draws `Cancel` as a bare underlined span beside the
              progress, in the same steel as the line. It is a `button` here
              rather than a span because a span is not reachable from a
              keyboard, and `04-laws.md` does not bend for a visual — the
              treatment is the frame's, the element is the accessible one.
            */}
            <button
              type="button"
              onClick={queue.cancel}
              className="shrink-0 text-sm font-semibold text-steel-600 underline underline-offset-2 hover:text-steel-700"
            >
              Cancel
            </button>
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          aria-label="Add portfolio photos"
          onChange={(event) => {
            queue.addFiles([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
      </div>

      {queue.heldBackNotice ? (
        <Banner status="pending" title="Some files were held back" className="mt-4">
          {queue.heldBackNotice}
        </Banner>
      ) : null}

      {/*
        One banner that counts, never a bare "Upload failed" toast. Each
        reason lives on its own tile below, so repeating them here would say
        the same thing twice.
      */}
      {failures ? (
        <Banner status="failed" title="Some photos didn't upload" className="mt-4">
          <span className="flex flex-wrap items-center gap-3">
            <span>{failures}</span>
            {canRetry ? (
              <button
                type="button"
                onClick={queue.retryAll}
                className="font-semibold text-clay-500 underline underline-offset-2"
              >
                Retry all that can
              </button>
            ) : null}
            <button
              type="button"
              onClick={queue.dismissAllFailed}
              className="font-semibold text-stone-700 underline underline-offset-2"
            >
              Dismiss
            </button>
          </span>
        </Banner>
      ) : null}

      {/*
        Tiles appear the moment files are picked and a failed one keeps its
        place, so the vendor can tell which shot it was. Completed tiles drop
        out because the photo itself is already in the gallery below.
      */}
      {inFlight.length > 0 ? (
        <ul
          aria-label="Uploads in progress"
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        >
          {inFlight.map((task) => (
            <UploadTile key={task.id} task={task} onDismiss={queue.dismiss} />
          ))}
        </ul>
      ) : null}

      {items.length === 0 && inFlight.length === 0 ? (
        <p className="mt-6 rounded-lg border border-stone-300 bg-card px-6 py-12 text-center text-sm leading-prose text-stone-600">
          No photos yet. Your gallery is what convinces a customer to send a request — eight to
          twelve of your best is plenty.
        </p>
      ) : (
        <>
          {/*
            States the rule the tile badge only shows the result of. Without it
            a vendor can see which photo is the cover but not how to change it.
          */}
          <p className="mt-6 text-sm leading-normal text-stone-600">
            The first photo is your cover — drag another into first place to change it.
          </p>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((item, index) => (
              <li
                key={item.id}
                draggable={!isBusy}
                onDragStart={() => setDraggingId(item.id)}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = items.findIndex((row) => row.id === draggingId);
                  setDraggingId(null);
                  if (from !== -1) {
                    move(from, index);
                  }
                }}
                className={cn(
                  'overflow-hidden rounded-lg border border-stone-300 bg-card shadow-sm',
                  draggingId === item.id && 'opacity-50',
                )}
              >
                <div className="relative">
                  {/* A plain <img>: user uploads on an origin that changes between
                    environments, so next/image would need per-env remote patterns. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnailUrl ?? item.imageUrl ?? ''}
                    alt={item.caption ?? ''}
                    className="aspect-[4/3] w-full cursor-grab object-cover"
                  />
                  {/*
                  The cover is a designation on a tile, never a second upload
                  (`40-states.md`) — so the designation has to be visible on the
                  tile. A vendor must be able to see which photo is their cover
                  without being told the rule about first place.
                */}
                  {index === 0 ? (
                    <span className="absolute top-2 left-2 rounded-md bg-stone-900/75 px-2 py-1 text-label font-semibold tracking-label text-stone-0 uppercase">
                      Cover
                    </span>
                  ) : null}
                </div>

                <div className="space-y-2 p-3">
                  <Input
                    defaultValue={item.caption ?? ''}
                    placeholder="Add a caption"
                    maxLength={MAX_CAPTION_LENGTH}
                    aria-label={`Caption for photo ${index + 1}`}
                    className={INPUT_TOUCH_HEIGHT}
                    onBlur={(event) => void saveCaption(item, event.target.value)}
                  />

                  <div className="flex items-center justify-between">
                    <div className="flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 lg:size-8"
                        aria-label={`Move photo ${index + 1} earlier`}
                        disabled={isBusy || index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ArrowLeft aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 lg:size-8"
                        aria-label={`Move photo ${index + 1} later`}
                        disabled={isBusy || index === items.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ArrowRight aria-hidden="true" />
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 lg:size-8"
                      aria-label={`Remove photo ${index + 1}`}
                      disabled={isBusy}
                      onClick={() => setPendingRemoval(item)}
                    >
                      <Trash2 aria-hidden="true" className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemoval(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this photo?</DialogTitle>
            <DialogDescription>
              It comes off your gallery straight away. You can upload it again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingRemoval(null)}
              disabled={isBusy}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isBusy}
              onClick={() => {
                if (pendingRemoval) {
                  void remove(pendingRemoval);
                }
              }}
            >
              Remove photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
