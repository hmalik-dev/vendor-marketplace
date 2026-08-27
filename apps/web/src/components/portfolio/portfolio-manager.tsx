'use client';

import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_CAPTION_LENGTH,
  MAX_UPLOAD_BYTES,
} from '@vendor-marketplace/shared';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiClientError } from '@/lib/api-client';
import { moveItem } from '@/lib/reorder';
import { useApi, useImageUpload } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { wirePortfolioItemSchema, wirePortfolioListSchema } from '@/lib/wire-schemas';
import type { WirePortfolioItem } from '@/lib/wire-schemas';
import { MAX_UPLOAD_MB } from '@/components/image-upload';
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
  const upload = useImageUpload();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<readonly WirePortfolioItem[]>(initialItems);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<WirePortfolioItem | null>(null);

  const addFiles = async (files: readonly File[]): Promise<void> => {
    const accepted = files.filter((file) => {
      if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
        toast.error(`${file.name} is not a JPEG, PNG, or WebP.`);
        return false;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name} is larger than the ${MAX_UPLOAD_MB}MB limit.`);
        return false;
      }
      return true;
    });

    if (accepted.length === 0) {
      return;
    }

    setUploadingCount((previous) => previous + accepted.length);

    // Sequential rather than parallel: the order photos land in is the order
    // they were chosen, and each upload re-encodes an image server-side.
    for (const file of accepted) {
      try {
        const stored = await upload(file, 'portfolio');
        const created = await request('/vendor/portfolio', {
          method: 'POST',
          body: { imageUrl: stored.imageUrl, thumbnailUrl: stored.thumbnailUrl },
          schema: wirePortfolioItemSchema,
        });

        setItems((previous) => [...previous, created]);
      } catch (error) {
        toast.error(
          error instanceof ApiClientError ? error.message : `Could not add ${file.name}.`,
        );
      } finally {
        setUploadingCount((previous) => previous - 1);
      }
    }

    router.refresh();
  };

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
            void addFiles([...event.dataTransfer.files]);
          }
        }}
        className={cn(
          'rounded-lg border-2 border-dashed p-4 transition-colors duration-(--duration-fast)',
          isDragging ? 'border-clay-400 bg-clay-100' : 'border-stone-200 bg-card',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-600">
            Drag photos here, or choose them. JPEG, PNG, or WebP, up to {MAX_UPLOAD_MB}MB each.
          </p>
          <div className="flex items-center gap-3">
            {uploadingCount > 0 ? (
              <span className="flex items-center gap-2 text-sm text-stone-600">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Uploading {uploadingCount}…
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

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          aria-label="Add portfolio photos"
          onChange={(event) => {
            void addFiles([...(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
      </div>

      {items.length === 0 ? (
        <p className="mt-6 rounded-lg border border-stone-300 bg-card px-6 py-12 text-center text-sm text-stone-600">
          No photos yet. Your gallery is what convinces a customer to send a request — eight to
          twelve of your best is plenty.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
              {/* A plain <img>: user uploads on an origin that changes between
                  environments, so next/image would need per-env remote patterns. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.thumbnailUrl ?? item.imageUrl}
                alt={item.caption ?? ''}
                className="aspect-[4/3] w-full cursor-grab object-cover"
              />

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
