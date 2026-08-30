'use client';

import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONSTRAINT_LINE,
} from '@vendor-marketplace/shared';
import { ImagePlus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { useImageUpload, UploadTransportError } from '@/lib/use-api';
import { connectionFailure, rejectedFailure, screenFile, type UploadFailure } from '@/lib/uploads';
import { cn } from '@/lib/utils';

export interface ImageUploadProps {
  label: string;
  /** Storage namespace; must be one of the API's known prefixes. */
  prefix: 'vendor-profile' | 'vendor-cover' | 'customer-profile';
  value: string | null;
  /**
   * Receives the stored **object key**, which is what gets persisted. The
   * preview uses the resolved URL the upload also returns, so a fresh upload
   * shows immediately without waiting for a round trip.
   */
  onChange: (imageKey: string, previewUrl: string) => void;
  /** Sizing utility for the preview frame. Height-based frames stop a wide
   * drop zone growing taller as the pane widens. */
  aspectClassName?: string;
  /** Renders the preview as a circle (96px, 160px from `sm`), for the profile photo. */
  rounded?: boolean;
  /** The format hint. Off for the second of a pair, which would repeat it. */
  showHint?: boolean;
  disabled?: boolean;
}

const ACCEPT = ACCEPTED_IMAGE_MIME_TYPES.join(',');
export const MAX_UPLOAD_MB = Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024));

/**
 * Click-or-drop upload for a single image. The file is validated here for a
 * fast, local rejection, but the server re-validates and re-encodes it — this
 * check is a courtesy, never the boundary.
 */
export function ImageUpload({
  label,
  prefix,
  value,
  onChange,
  aspectClassName = 'aspect-[21/9]',
  rounded = false,
  showHint = true,
  disabled = false,
}: ImageUploadProps): React.ReactElement {
  const upload = useImageUpload();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<UploadFailure | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isUploading = progress !== null;

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) {
      return;
    }

    /*
     * A refusal states what happened and how to fix it, in place, and stays
     * on screen — a toast that says "Upload failed" and then disappears is
     * the thing `40-states.md` rules out.
     */
    const screened = screenFile(file);
    if (screened) {
      setFailure(screened);
      return;
    }

    setFailure(null);
    setProgress(0);
    try {
      const stored = await upload(file, prefix, { onProgress: setProgress });
      onChange(stored.imageKey, stored.imageUrl);
      toast.success(`${label} updated.`);
    } catch (error) {
      // The previous image is left in place: `onChange` never ran.
      setFailure(
        error instanceof UploadTransportError
          ? connectionFailure()
          : error instanceof ApiClientError
            ? rejectedFailure(error.message, error.code)
            : rejectedFailure('The server would not take it.'),
      );
    } finally {
      setProgress(null);
      if (inputRef.current) {
        // Clearing the input lets the same file be retried after a failure.
        inputRef.current.value = '';
      }
    }
  };

  const isBusy = isUploading || disabled;

  return (
    <div className="space-y-2">
      {/*
        The frames draw this one as a `.lbl` like every other field label, so
        it takes the same micro-label treatment. It is a bare `<label>` rather
        than the `Label` primitive because it labels a file input it owns.
      */}
      <label
        htmlFor={inputId}
        className="block text-label font-semibold tracking-label text-stone-600 uppercase"
      >
        {label}
      </label>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!isBusy) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (!isBusy) {
            void handleFile(event.dataTransfer.files?.[0]);
          }
        }}
        className={cn(
          /*
           * The frames draw every drop zone as a 1px `stone-400` dash over the
           * hatched placeholder, not a 2px `stone-200` dash over flat
           * `stone-50`. `placeholder-hatch` is the frames' own gradient, and
           * the uploaded image covers it once there is one.
           */
          'relative flex w-full items-center justify-center overflow-hidden border border-dashed border-stone-400 transition-colors',
          value ? 'bg-stone-50' : 'placeholder-hatch',
          // 128px circle from `sm`, the size frame 09 draws the profile photo.
          rounded ? 'size-24 rounded-full sm:size-32' : cn(aspectClassName, 'rounded-lg'),
          isDragging && 'border-clay-400 bg-clay-100',
          isBusy && 'opacity-70',
        )}
      >
        {value ? (
          // A plain <img>: these are user uploads on an origin that changes
          // between environments, so next/image's loader would need per-env
          // remote patterns for no benefit at this size.
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="size-full object-cover" />
            {/*
              The frame labels a filled zone `Replace`, and without it there is
              no visible affordance for changing a photo once one exists — the
              zone still opens the picker, but nothing says so. Sits over the
              foot of the image so it reads against the photograph.
            */}
            <span className="absolute inset-x-0 bottom-0 bg-stone-900/55 py-1 text-center text-helper font-semibold text-stone-0">
              Replace
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 px-2 text-center text-xs text-stone-600">
            <ImagePlus aria-hidden="true" className="size-5" />
            {rounded ? (
              'Add photo'
            ) : (
              <>
                {/* The full invitation needs room; a narrow frame gets the short form. */}
                <span className="hidden sm:inline">Drag an image here, or click to choose</span>
                <span className="sm:hidden">Add cover</span>
              </>
            )}
          </span>
        )}

        {/*
          Determinate, never a spinner: the percentage is the whole point of
          watching a large photograph go up.
        */}
        {isUploading ? (
          <span
            role="status"
            className="absolute inset-0 flex items-center justify-center bg-stone-900/40 text-sm font-semibold text-stone-0"
          >
            {progress}%<span className="sr-only"> uploaded</span>
          </span>
        ) : null}

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          disabled={isBusy}
          onChange={(event) => void handleFile(event.target.files?.[0])}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </div>
      {showHint ? <p className="text-xs text-stone-600">{UPLOAD_CONSTRAINT_LINE}</p> : null}

      {/*
        The reason and its matching fix, side by side and persistent. Gold for
        a file that is valid but not good enough to publish; red for one that
        failed outright — `40-states.md`, and the two never swap.
      */}
      {failure ? (
        <p
          role="status"
          className={cn('text-xs', failure.tone === 'gold' ? 'text-gold-600' : 'text-error-500')}
        >
          {failure.reason} <span className="text-stone-600">{failure.fix}</span>
        </p>
      ) : null}
    </div>
  );
}
