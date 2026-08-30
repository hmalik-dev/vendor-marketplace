'use client';

import {
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_CONSTRAINT_LINE,
  type UploadedImage,
} from '@vendor-marketplace/shared';
import { ImagePlus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { useImageUpload, UploadTransportError } from '@/lib/use-api';
import { toImageSrc } from '@/lib/wire-schemas';
import {
  connectionFailure,
  previewFailure,
  rejectedFailure,
  screenFile,
  type UploadFailure,
} from '@/lib/uploads';
import { cn } from '@/lib/utils';

export interface ImageUploadProps {
  label: string;
  /** Storage namespace; must be one of the API's known prefixes. */
  prefix: 'vendor-profile' | 'vendor-cover' | 'customer-profile';
  /**
   * What the form holds: an **object key** after an upload, and whatever the
   * wire schema resolved before one. `toImageSrc` maps either to a `src`, so
   * the caller never has to know which it is holding.
   */
  value: string | null;
  /**
   * Receives the stored **object key**, which is what gets persisted.
   *
   * It fires once the preview has actually rendered, not when the request
   * returns `201`. A form that commits on the status code alone would hold a
   * key whose image nobody has seen.
   */
  onChange: (imageKey: string) => void;
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
  /**
   * The upload this component made, kept for as long as it is on screen.
   *
   * The preview keeps the URL the API resolved rather than re-deriving one:
   * the API builds it from `S3_PUBLIC_URL` and the browser would build it from
   * `NEXT_PUBLIC_S3_PUBLIC_URL`, and nothing makes those agree — a web deploy
   * missing the public one is accepted by `assertWebEnv`, which validates only
   * the `core` and `auth` capabilities. Swapping to the derived URL at the
   * moment of success is exactly how this ticket's symptom comes back: the
   * circle blanks while the toast says it worked.
   */
  const [uploaded, setUploaded] = useState<UploadedImage | null>(null);
  /*
   * Held explicitly rather than derived from `uploaded.imageKey !== value`:
   * derived, it would stay true forever for a caller that ignored `onChange`,
   * and the zone would sit disabled with no way out.
   */
  const [isAwaitingPreview, setIsAwaitingPreview] = useState(false);

  const isUploading = progress !== null;
  /*
   * `toImageSrc` covers the other direction — a `value` that is a bare object
   * key — through the one place this app resolves stored images.
   */
  const src = uploaded !== null ? uploaded.imageUrl : toImageSrc(value);

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
      /*
       * Neither the form nor the toast is touched here. The `<img>` below is
       * pointed at the resolved URL, and its `load` event — the only evidence
       * the vendor can actually see their photo — is what commits both.
       */
      setUploaded(stored);
      setIsAwaitingPreview(true);
    } catch (error) {
      // The previous image is left in place: `onChange` never ran.
      setFailure(
        error instanceof UploadTransportError
          ? connectionFailure()
          : rejectedFailure(
              error instanceof ApiClientError ? error.message : 'The server would not take it.',
            ),
      );
    } finally {
      setProgress(null);
      if (inputRef.current) {
        // Clearing the input lets the same file be retried after a failure.
        inputRef.current.value = '';
      }
    }
  };

  /**
   * Commits a stored file once its preview has rendered. `load` is the whole
   * signal: the request already returned `201`, so this is what separates a
   * photograph the vendor can see from one they cannot.
   */
  const handlePreviewLoaded = (): void => {
    if (!isAwaitingPreview || uploaded === null) {
      return;
    }
    setIsAwaitingPreview(false);
    onChange(uploaded.imageKey);
    toast.success(`${label} updated.`);
  };

  /**
   * A stored file whose preview will not render. The previous image is left in
   * place — `onChange` never ran — so an empty zone goes back to inviting a
   * photo rather than sitting blank with nothing to say.
   */
  const handlePreviewFailed = (): void => {
    if (!isAwaitingPreview) {
      return;
    }
    setIsAwaitingPreview(false);
    setUploaded(null);
    setFailure(previewFailure());
  };

  // Verifying the preview is still work in flight: a second file picked during
  // it would settle against the wrong upload.
  const isBusy = isUploading || isAwaitingPreview || disabled;

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
          src ? 'bg-stone-50' : 'placeholder-hatch',
          // 128px circle from `sm`, the size frame 09 draws the profile photo.
          rounded ? 'size-24 rounded-full sm:size-32' : cn(aspectClassName, 'rounded-lg'),
          isDragging && 'border-clay-400 bg-clay-100',
          isBusy && 'opacity-70',
        )}
      >
        {src ? (
          // A plain <img>: these are user uploads on an origin that changes
          // between environments, so next/image's loader would need per-env
          // remote patterns for no benefit at this size.
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="size-full object-cover"
              onLoad={handlePreviewLoaded}
              onError={handlePreviewFailed}
            />
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
        {isUploading || isAwaitingPreview ? (
          <span
            role="status"
            className="absolute inset-0 flex items-center justify-center bg-stone-900/40 text-sm font-semibold text-stone-0"
          >
            {/*
              The bytes are in once the request resolves; what is left is the
              browser drawing them. Holding at 100 keeps the zone determinate
              rather than disabled with nothing on it, which is the one state
              `40-states.md` does not allow an uploader to sit in.
            */}
            {progress ?? 100}%<span className="sr-only"> uploaded</span>
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
