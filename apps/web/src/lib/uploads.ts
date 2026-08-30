import {
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_MIME_TYPES,
  ERROR_CODES,
  type ErrorCode,
  MAX_UPLOAD_BATCH_FILES,
  BYTES_PER_MB,
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
    | 'not-allowed'
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

/**
 * A file's size in the units its owner sees.
 *
 * Decimal, matching `BYTES_PER_MB` and the file manager. This divided by
 * 1024² while labelling the result "MB", so a 70,062,643-byte file read as
 * `66.8 MB` where Finder said `70.1 MB` — a 4.8% under-report against the only
 * number the vendor can check.
 *
 * Small files are reported in **kB** rather than as a fraction of a megabyte:
 * `340 kB` is a size, `0.3 MB` is a rounding artefact, and a vendor refused for
 * a too-narrow 200 kB image should not be shown `0.2 MB`.
 */
export function formatFileSize(bytes: number, decimals = 1): string {
  if (bytes < BYTES_PER_MB) {
    return `${Math.round(bytes / 1_000)} kB`;
  }

  const factor = 10 ** decimals;
  return `${Math.round((bytes / BYTES_PER_MB) * factor) / factor} MB`;
}

const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES / BYTES_PER_MB;

/**
 * The refused size, at whatever precision it takes to not read as the limit.
 *
 * The check is `size > MAX_UPLOAD_BYTES`, so every refused file is strictly
 * larger — but at one decimal a file 4 kB over rendered as `12 MB`, and the
 * vendor was told "12 MB is over the 12 MB limit." Correct arithmetic, useless
 * sentence, and no number they could act on.
 *
 * Adding decimals until the two differ keeps the message honest without
 * overstating the excess the way rounding up would: 4 kB over reads `12.004 MB`,
 * not `12.1 MB`.
 */
function formatRefusedSize(bytes: number): string {
  const limit = `${MAX_UPLOAD_MB} MB`;

  for (const decimals of [1, 2, 3]) {
    const rendered = formatFileSize(bytes, decimals);
    if (rendered !== limit) {
      return rendered;
    }
  }

  // Beyond a thousandth of a megabyte the excess is a handful of bytes; state
  // it exactly rather than pretending to a rounder number.
  return `${bytes.toLocaleString('en-US')} bytes`;
}

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
    /*
      Capitalised at the front, which the extensionless branch was not: a JPG
      renamed `noextension` produced "file isn't a format we can publish."
      Every other failure sentence starts with a capital, and this one only
      escaped because its first word is interpolated.
    */
    reason: `${extension[0]?.toUpperCase() ?? ''}${extension.slice(1)} isn't a format we can publish.`,
    fix: `${ACCEPTED_IMAGE_LABEL} only. ${EXPORT_ADVICE}`,
    retryable: false,
  };
}

export function tooLargeFailure(sizeBytes: number): UploadFailure {
  return {
    kind: 'too-large',
    tone: 'red',
    reason: `${formatRefusedSize(sizeBytes)} is over the ${MAX_UPLOAD_MB} MB limit.`,
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

const CONSTRAINT_FIX = `${ACCEPTED_IMAGE_LABEL} · under ${MAX_UPLOAD_MB} MB · at least ${MIN_UPLOAD_IMAGE_WIDTH}px wide.`;

/**
 * A refusal the server sent, put into words the reader can act on.
 *
 * The allow-list runs the safe way round: the server's own sentence is shown
 * because its code says it was written for a person, never because nothing
 * recognised it as internal. `VALIDATION_ERROR` is that code ("Image is 900px
 * wide."). An authorization refusal instead carries a rule written for whoever
 * wrote the route, and rendering it verbatim is what put "This endpoint
 * requires the vendor role" on the customer profile page. A caller with no
 * code to offer gets our copy, so an omitted `code` is the safe path rather
 * than the leaky one.
 */
export function rejectedFailure(message: string, code?: ErrorCode): UploadFailure {
  if (code === ERROR_CODES.UNAUTHORIZED) {
    return {
      kind: 'not-allowed',
      tone: 'red',
      reason: "You've been signed out.",
      fix: 'Sign in again, then add the photo.',
      retryable: false,
    };
  }

  // A different fix from the one above, and not interchangeable with it:
  // signing in again does not turn this into an account that may upload here.
  if (code === ERROR_CODES.FORBIDDEN) {
    return {
      kind: 'not-allowed',
      tone: 'red',
      reason: "This account can't add a photo here.",
      fix: 'Switch to the account this page belongs to.',
      retryable: false,
    };
  }

  if (code === ERROR_CODES.VALIDATION_ERROR) {
    return {
      kind: 'rejected',
      tone: 'red',
      reason: message,
      fix: CONSTRAINT_FIX,
      retryable: false,
    };
  }

  // Nothing said the bytes were wrong, so one more attempt is worth offering.
  return {
    kind: 'rejected',
    tone: 'red',
    reason: "We couldn't save that photo.",
    fix: 'Try again in a moment.',
    retryable: true,
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

/**
 * "3 files were held back" — named in the banner so nothing vanishes silently.
 *
 * The noun agreed for one file and the verb did not, so picking 21 read
 * "1 file **were** held back". Both inflect together now, and the trailing
 * "Add them next" follows the same count — "Add it next" for one.
 */
export function heldBackSentence(names: readonly string[], limit = MAX_UPLOAD_BATCH_FILES): string {
  const single = names.length === 1;
  const noun = single ? 'file' : 'files';
  const verb = single ? 'was' : 'were';
  const pronoun = single ? 'it' : 'them';

  return `${limit} files upload at a time, so ${names.length} ${noun} ${verb} held back: ${names.join(', ')}. Add ${pronoun} next.`;
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
  /*
   * Bytes that can still be sent. A file refused locally — wrong format, over
   * the size ceiling, too narrow — enters the list already `failed`, carrying
   * its full size, and is then skipped by the send loop. Counting it put bytes
   * in the denominator that are structurally impossible to send, and it failed
   * worst exactly where it showed most: an over-size rejection is by definition
   * the largest file in the batch, so a 40 MB refusal inflated "of X MB" by
   * 40 MB and the line could never converge.
   *
   * A file that failed *after* sending something keeps its bytes: those really
   * did go out, and removing them would make the line run backwards.
   */
  const sendable = tasks.filter((task) => task.status !== 'failed' || task.progress > 0);

  return {
    settled: tasks.filter((task) => task.status === 'done' || task.status === 'failed').length,
    total: tasks.length,
    uploadedBytes: sendable.reduce((sum, task) => sum + (task.sizeBytes * task.progress) / 100, 0),
    totalBytes: sendable.reduce((sum, task) => sum + task.sizeBytes, 0),
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

  return `Uploading ${Math.min(settled + 1, total)} of ${total} — ${formatFileSize(uploadedBytes)} of ${formatFileSize(totalBytes)}`;
}

/**
 * The failure banner's sentence. It counts rather than repeating each reason,
 * because every reason is already on its own tile.
 *
 * **"Everything else saved" is only true once nothing is still in flight.** It
 * was said the moment the first file failed: with ten files and two failing
 * client-side, the banner claimed everything else had saved at ~800ms, when one
 * was uploading and seven were still queued and nothing had been persisted at
 * all. The sentence described the end of a batch that had barely started.
 *
 * While work remains it says what is still happening instead, and the count
 * keeps climbing as further files fail — so the banner always describes the
 * state at the moment it is read rather than the state it expects to reach.
 */
export function failureSentence(tasks: readonly UploadTask[]): string | null {
  const failed = tasks.filter((task) => task.status === 'failed');
  if (failed.length === 0) {
    return null;
  }

  const noun = failed.length === 1 ? 'photo' : 'photos';
  const inFlight = tasks.filter(
    (task) => task.status === 'queued' || task.status === 'uploading',
  ).length;

  if (inFlight > 0) {
    return `${failed.length} ${noun} didn't upload. ${inFlight} still going.`;
  }

  const saved = tasks.filter((task) => task.status === 'done').length;
  // Nothing else to claim when every file in the batch failed; saying
  // "everything else saved" of an empty remainder is the same false note.
  return saved === 0
    ? `${failed.length} ${noun} didn't upload.`
    : `${failed.length} ${noun} didn't upload. Everything else saved.`;
}

/** The subset "Retry all that can" would actually re-send. */
export function retryableTasks(tasks: readonly UploadTask[]): UploadTask[] {
  return tasks.filter((task) => task.status === 'failed' && task.failure?.retryable === true);
}

/**
 * Whether a batch still has work that leaving the page would destroy.
 *
 * A **queued** file counts. It has not started transferring, and it is just as
 * gone as one caught mid-transfer if the tab closes — the vendor picked eight
 * photos and the queue runs them a few at a time, so most of a large batch
 * spends most of its life in this state.
 *
 * Exported rather than inlined into `useUploadQueue` because three places have
 * to agree on it: the hook, the aggregate line's Cancel control, and the
 * `beforeunload` guard. A copy of the predicate inside a test's mock of the
 * hook is not agreement — it is a second definition that stays green while the
 * real one drifts.
 */
export function isBatchInFlight(tasks: readonly UploadTask[]): boolean {
  return tasks.some((task) => task.status === 'queued' || task.status === 'uploading');
}
