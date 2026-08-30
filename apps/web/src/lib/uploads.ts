import {
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_UPLOAD_BATCH_FILES,
  MAX_UPLOAD_BYTES,
  MIN_UPLOAD_IMAGE_WIDTH,
} from '@vendor-marketplace/shared';

/**
 * The upload model behind frames `24` and `25`.
 *
 * Everything here is pure: classification, wording and the batch split are
 * decided without touching the network or the DOM, which is what lets the
 * eight-files-two-failures case be a unit test rather than a manual click.
 * The React queue in `use-upload-queue` supplies the transport.
 */

/**
 * `40-states.md` colour semantics. Red is "it failed"; gold is "waiting on
 * someone" — used here for a file that is technically fine but not good
 * enough to publish, where the vendor has a decision to make rather than an
 * error to clear. Red is never used for a merely-suboptimal file.
 */
export type UploadFailureTone = 'red' | 'gold';

export interface UploadFailure {
  /** Machine name, for tests and for grouping retryable failures. */
  kind:
    | 'unsupported-format'
    | 'too-large'
    | 'too-narrow'
    | 'connection-dropped'
    | 'rejected'
    | 'preview-broken';
  tone: UploadFailureTone;
  /** One sentence saying what happened to this file, in these words. */
  reason: string;
  /** The matching fix. Every failure names one — never a bare "Upload failed". */
  fix: string;
  /**
   * Whether the same bytes are worth sending again. A dropped connection is;
   * a 40 MB file is not, and offering Retry on it would waste the vendor's
   * time twice.
   */
  retryable: boolean;
}

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed';

export interface UploadTask {
  id: string;
  name: string;
  sizeBytes: number;
  status: UploadStatus;
  /** 0–100, and determinate: `40-states.md` allows no indeterminate spinner. */
  progress: number;
  failure?: UploadFailure;
}

const MEGABYTE = 1024 * 1024;

/** One decimal, so `18.2 MB` rather than `18.2000000001 MB`. */
export function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / MEGABYTE) * 10) / 10} MB`;
}

const MAX_UPLOAD_MB = Math.floor(MAX_UPLOAD_BYTES / MEGABYTE);

/**
 * The export advice that accompanies a format or size refusal. It is concrete
 * on purpose — "JPG at 2400px wide" is something a vendor can act on in their
 * editor, where "reduce the file size" is not.
 */
const EXPORT_ADVICE = 'Export it as a JPG at 2400px wide.';

export function unsupportedFormatFailure(fileName: string): UploadFailure {
  const extension = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.') + 1).toUpperCase()
    : 'file';

  return {
    kind: 'unsupported-format',
    tone: 'red',
    reason: `${extension} isn't a format we can publish.`,
    fix: `${ACCEPTED_IMAGE_LABEL} only. ${EXPORT_ADVICE}`,
    retryable: false,
  };
}

export function tooLargeFailure(sizeBytes: number): UploadFailure {
  return {
    kind: 'too-large',
    tone: 'red',
    reason: `${formatMegabytes(sizeBytes)} is over the ${MAX_UPLOAD_MB} MB limit.`,
    fix: EXPORT_ADVICE,
    retryable: false,
  };
}

/**
 * Gold, not red: the file is valid, it would simply render soft. Calling it
 * "invalid" would send the vendor looking for a fault that is not there.
 */
export function tooNarrowFailure(width: number): UploadFailure {
  return {
    kind: 'too-narrow',
    tone: 'gold',
    reason: `${width}px wide would look soft on your profile.`,
    fix: `Export it at least ${MIN_UPLOAD_IMAGE_WIDTH}px wide.`,
    retryable: false,
  };
}

export function connectionFailure(): UploadFailure {
  return {
    kind: 'connection-dropped',
    tone: 'red',
    reason: 'The connection dropped part-way.',
    fix: 'The file is fine — send it again.',
    retryable: true,
  };
}

/** Whatever the server said, when it said something specific. */
export function rejectedFailure(message: string): UploadFailure {
  return {
    kind: 'rejected',
    tone: 'red',
    reason: message,
    fix: `${ACCEPTED_IMAGE_LABEL} · under ${MAX_UPLOAD_MB} MB · at least ${MIN_UPLOAD_IMAGE_WIDTH}px wide.`,
    retryable: false,
  };
}

/**
 * The store succeeded and the preview still would not render.
 *
 * Red rather than gold: nothing about the file is a judgement call, the
 * picture simply is not on screen. Retryable, because the bytes were fine —
 * `40-states.md` reserves a non-retryable red for a file that cannot work.
 *
 * This exists so a `201` is never announced as success on the strength of the
 * status code alone. `complete === true` is also true for a broken image, so
 * the load event is the only honest signal that the vendor can see their photo.
 */
export function previewFailure(): UploadFailure {
  return {
    kind: 'preview-broken',
    tone: 'red',
    reason: 'That photo saved, but the preview would not load.',
    /*
     * Not "send it again": the bytes are already stored, so a re-send produces
     * a second object at a second key that will not render either — one orphan
     * in the bucket per attempt, and no way out. Reloading is the action that
     * can actually work, because it re-resolves the URL.
     */
    fix: 'Reload the page to see it.',
    retryable: false,
  };
}

/**
 * The checks worth doing before a byte leaves the browser. The server
 * re-validates all of them, so this is a courtesy that saves a round trip —
 * never the boundary. Width is not checked here — reading it means decoding
 * the image, which is `screenDimensions` below, run once per file rather than
 * for the whole selection before the first tile appears.
 */
export function screenFile(file: {
  name: string;
  type: string;
  size: number;
}): UploadFailure | null {
  if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return unsupportedFormatFailure(file.name);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return tooLargeFailure(file.size);
  }
  return null;
}

/**
 * Reads an image's width in the browser so a too-narrow file gets its own
 * message — and its own colour — before a byte goes out.
 *
 * `40-states.md` gives this failure gold rather than red: the file is valid
 * and would simply render soft, which is a decision for the vendor rather than
 * an error to clear. Routing it through the server instead would come back as
 * a generic red refusal, so the tone would be wrong precisely where the rule
 * says it does not bend.
 *
 * `createImageBitmap` is absent in some environments; there it returns null and
 * the server's own width check remains the boundary, as it is for every rule
 * here.
 */
export async function readImageWidth(file: Blob): Promise<number | null> {
  if (typeof createImageBitmap !== 'function') {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width } = bitmap;
    bitmap.close();
    return width;
  } catch {
    // Undecodable bytes are the server's refusal to make, with better wording.
    return null;
  }
}

/** The width floor, checked once the file has been screened on type and size. */
export async function screenDimensions(file: Blob): Promise<UploadFailure | null> {
  const width = await readImageWidth(file);

  return width !== null && width < MIN_UPLOAD_IMAGE_WIDTH ? tooNarrowFailure(width) : null;
}

export interface BatchSplit<T> {
  accepted: T[];
  /** Trimmed off the end of the selection, in the order they were picked. */
  heldBack: T[];
}

/**
 * Splits an over-large selection instead of refusing it.
 *
 * `40-states.md` is explicit that the extras are held back and named, not that
 * the batch is rejected: the twenty that fit are still work the vendor does
 * not have to do again.
 */
export function splitBatch<T>(files: readonly T[], limit = MAX_UPLOAD_BATCH_FILES): BatchSplit<T> {
  return {
    accepted: files.slice(0, limit),
    heldBack: files.slice(limit),
  };
}

/** "3 files were held back" — named in the banner so nothing vanishes silently. */
export function heldBackSentence(names: readonly string[], limit = MAX_UPLOAD_BATCH_FILES): string {
  const noun = names.length === 1 ? 'file' : 'files';
  return `${limit} files upload at a time, so ${names.length} ${noun} were held back: ${names.join(', ')}. Add them next.`;
}

export interface BatchProgress {
  /** Files that have finished, successfully or not. */
  settled: number;
  total: number;
  uploadedBytes: number;
  totalBytes: number;
  failed: number;
}

export function summarise(tasks: readonly UploadTask[]): BatchProgress {
  return {
    settled: tasks.filter((task) => task.status === 'done' || task.status === 'failed').length,
    total: tasks.length,
    uploadedBytes: tasks.reduce((sum, task) => sum + (task.sizeBytes * task.progress) / 100, 0),
    totalBytes: tasks.reduce((sum, task) => sum + task.sizeBytes, 0),
    failed: tasks.filter((task) => task.status === 'failed').length,
  };
}

/**
 * The one aggregate line, in steel — `Uploading 4 of 8 — 18.2 MB of 29.4 MB`.
 * It counts the file in flight rather than the ones already finished, which is
 * what a person watching a progress line expects "4 of 8" to mean.
 */
export function aggregateLine(tasks: readonly UploadTask[]): string | null {
  const { settled, total, uploadedBytes, totalBytes } = summarise(tasks);
  if (total === 0 || settled === total) {
    return null;
  }

  return `Uploading ${Math.min(settled + 1, total)} of ${total} — ${formatMegabytes(uploadedBytes)} of ${formatMegabytes(totalBytes)}`;
}

/**
 * The failure banner's sentence. It counts rather than repeating each reason,
 * because every reason is already on its own tile.
 */
export function failureSentence(tasks: readonly UploadTask[]): string | null {
  const failed = tasks.filter((task) => task.status === 'failed');
  if (failed.length === 0) {
    return null;
  }

  const noun = failed.length === 1 ? 'photo' : 'photos';
  return `${failed.length} ${noun} didn't upload. Everything else saved.`;
}

/** The subset "Retry all that can" would actually re-send. */
export function retryableTasks(tasks: readonly UploadTask[]): UploadTask[] {
  return tasks.filter((task) => task.status === 'failed' && task.failure?.retryable === true);
}
