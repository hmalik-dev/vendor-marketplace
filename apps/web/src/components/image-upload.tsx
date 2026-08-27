'use client';

import { ACCEPTED_IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES } from '@vendor-marketplace/shared';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { useImageUpload } from '@/lib/use-api';
import { cn } from '@/lib/utils';

export interface ImageUploadProps {
  label: string;
  /** Storage namespace; must be one of the API's known prefixes. */
  prefix: 'vendor-profile' | 'vendor-cover';
  value: string | null;
  onChange: (imageUrl: string) => void;
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
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) {
      return;
    }

    if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`That image is larger than the ${MAX_UPLOAD_MB}MB limit.`);
      return;
    }

    setIsUploading(true);
    try {
      const stored = await upload(file, prefix);
      onChange(stored.imageUrl);
      toast.success(`${label} updated.`);
    } catch (error) {
      // The previous image is left in place: `onChange` never ran.
      toast.error(error instanceof ApiClientError ? error.message : 'That upload failed.');
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        // Clearing the input lets the same file be retried after a failure.
        inputRef.current.value = '';
      }
    }
  };

  const isBusy = isUploading || disabled;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-stone-800">
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
          'relative flex w-full items-center justify-center overflow-hidden border-2 border-dashed border-stone-200 bg-stone-50 transition-colors',
          rounded ? 'size-24 rounded-full sm:size-40' : cn(aspectClassName, 'rounded-lg'),
          isDragging && 'border-clay-400 bg-clay-100',
          isBusy && 'opacity-70',
        )}
      >
        {value ? (
          // A plain <img>: these are user uploads on an origin that changes
          // between environments, so next/image's loader would need per-env
          // remote patterns for no benefit at this size.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" />
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

        {isUploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-stone-900/30">
            <Loader2 aria-hidden="true" className="size-6 animate-spin text-stone-0" />
            <span className="sr-only">Uploading…</span>
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
      {showHint ? (
        <p className="text-xs text-stone-600">JPEG, PNG, or WebP, up to {MAX_UPLOAD_MB}MB.</p>
      ) : null}
    </div>
  );
}
