'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError } from './api-client';
import { useImageUpload, UploadTransportError } from './use-api';
import {
  connectionFailure,
  heldBackSentence,
  isBatchInFlight,
  rejectedFailure,
  screenDimensions,
  screenFile,
  splitBatch,
  type UploadFailure,
  type UploadTask,
} from './uploads';

/**
 * The upload queue behind frames `24` and `25`.
 *
 * Non-blocking by contract: tiles appear the moment files are picked, the
 * vendor keeps editing everything else, and each file is saved on its own — a
 * failure never rolls back a sibling. The wording and the classification live
 * in `uploads.ts`, which is pure; this owns only the transport and the React
 * state around it.
 */

export interface UseUploadQueueOptions {
  /** Storage namespace; must be one of the API's known prefixes. */
  prefix: string;
  /**
   * Persists one finished upload. Returning normally marks the tile done;
   * throwing marks it failed, because an image in object storage that no row
   * points at is not a photo the vendor has.
   */
  onUploaded: (stored: { imageKey: string; thumbnailKey: string | null }) => Promise<void>;
}

export interface UploadQueue {
  tasks: readonly UploadTask[];
  /** The gold batch-overflow line, or null. Cleared on the next selection. */
  heldBackNotice: string | null;
  /**
   * Whether anything is still queued or sending.
   *
   * Published because a `File` is not serialisable and cannot survive a
   * navigation: nothing can resume the batch, so the only honest thing to do
   * with a page-leave is warn about it while this is true.
   */
  inFlight: boolean;
  addFiles: (files: readonly File[]) => void;
  /** Re-sends every failed file whose bytes are still good. */
  retryAll: () => void;
  /** Removes one settled tile — used after the vendor has read its reason. */
  dismiss: (id: string) => void;
  /** Clears every failed tile and the overflow notice at once. */
  dismissAllFailed: () => void;
  /**
   * Stops the batch: the file in flight is aborted and nothing queued behind
   * it is started. Anything already saved stays saved — frame `24`'s `Cancel`.
   */
  cancel: () => void;
}

/** Distinct per file, and stable across a retry so the tile keeps its place. */
let sequence = 0;
function nextId(): string {
  sequence += 1;
  return `upload-${sequence}`;
}

function classify(error: unknown): UploadFailure {
  if (error instanceof UploadTransportError) {
    return connectionFailure();
  }
  if (error instanceof ApiClientError) {
    return rejectedFailure(error.message, error.code);
  }
  return connectionFailure();
}

export function useUploadQueue({ prefix, onUploaded }: UseUploadQueueOptions): UploadQueue {
  const upload = useImageUpload();
  const [tasks, setTasks] = useState<readonly UploadTask[]>([]);
  const [heldBackNotice, setHeldBackNotice] = useState<string | null>(null);

  /*
   * One controller for **all** work currently in flight, not one per call.
   *
   * A ref rather than state because the loops below read it between files and
   * must see the current value — a state read would be closed over the render
   * that started the batch and would never observe a cancel.
   *
   * Shared deliberately: a vendor who picks three photos and then three more
   * before the first three finish has two loops running, and `Cancel` means
   * "stop uploading", not "stop the most recent selection". Giving the second
   * call its own controller would leave the first batch running behind a
   * button that claims to have stopped it.
   */
  const batch = useRef<AbortController | null>(null);

  /** The controller for new work, reusing the live one if a batch is running. */
  const currentBatch = useCallback((): AbortController => {
    const live = batch.current;
    if (live && !live.signal.aborted) {
      return live;
    }

    const fresh = new AbortController();
    batch.current = fresh;
    return fresh;
  }, []);

  /*
   * The File objects never enter React state: they are not serialisable, they
   * are large, and only the retry path needs them again. The tile's id is the
   * key into this map, so a retry re-sends exactly the bytes that failed.
   */
  const filesById = useRef(new Map<string, File>());

  const patch = useCallback((id: string, changes: Partial<UploadTask>): void => {
    setTasks((previous) =>
      previous.map((task) => (task.id === id ? { ...task, ...changes } : task)),
    );
  }, []);

  const send = useCallback(
    async (id: string, file: File, signal?: AbortSignal): Promise<void> => {
      /*
       * Read through a call, not a property access: `aborted` is live state,
       * and TypeScript narrows a repeated property read as though it were not.
       */
      const cancelled = (): boolean => signal?.aborted === true;

      /** Drops a tile the vendor asked to stop. Not a failure — they chose it. */
      const drop = (): void => {
        filesById.current.delete(id);
        setTasks((previous) => previous.filter((task) => task.id !== id));
      };

      patch(id, { status: 'uploading', progress: 0, failure: undefined });

      /*
       * The width floor is checked here rather than with the type and size,
       * because reading it means decoding the image — cheap enough per file,
       * too slow to do for twenty before the first tile appears.
       */
      const narrow = await screenDimensions(file);
      if (narrow) {
        patch(id, { status: 'failed', failure: narrow });
        return;
      }

      /*
       * Re-checked after the decode. `screenDimensions` decodes the image,
       * which takes tens of milliseconds on a large JPEG — a window the vendor
       * is very likely to click Cancel inside, because the tiles and the
       * control both render the instant files are picked.
       */
      if (cancelled()) {
        drop();
        return;
      }

      try {
        const stored = await upload(file, prefix, {
          onProgress: (percent) => patch(id, { progress: percent }),
          ...(signal ? { signal } : {}),
        });

        // The bytes are up but the row is not written yet, so the tile stays
        // in `uploading` until the caller has persisted it.
        patch(id, { progress: 100 });
        await onUploaded(stored);

        filesById.current.delete(id);
        patch(id, { status: 'done', progress: 100 });
      } catch (error) {
        /*
         * A cancelled file is not a failed one. `abort()` surfaces as a
         * transport error — the request never completed — but the vendor asked
         * for that, so showing them "check your connection" beside a button
         * they just pressed would be a lie. The tile is removed instead.
         */
        if (cancelled()) {
          drop();
          return;
        }

        patch(id, { status: 'failed', failure: classify(error) });
      }
    },
    [onUploaded, patch, prefix, upload],
  );

  const addFiles = useCallback(
    (files: readonly File[]): void => {
      if (files.length === 0) {
        return;
      }

      const { accepted, heldBack } = splitBatch(files);
      setHeldBackNotice(
        heldBack.length > 0 ? heldBackSentence(heldBack.map((file) => file.name)) : null,
      );

      const queued = accepted.map((file) => {
        const id = nextId();
        const failure = screenFile(file);

        if (failure === null) {
          filesById.current.set(id, file);
        }

        return {
          task: {
            id,
            name: file.name,
            sizeBytes: file.size,
            status: failure === null ? ('queued' as const) : ('failed' as const),
            progress: 0,
            ...(failure === null ? {} : { failure }),
          },
          file,
          rejected: failure !== null,
        };
      });

      setTasks((previous) => [...previous, ...queued.map((entry) => entry.task)]);

      /*
       * Sequential rather than parallel: the order photos land in is the order
       * they were picked, and each upload re-encodes an image server-side, so
       * twenty at once would queue on the server anyway with worse feedback.
       */
      const controller = currentBatch();

      void (async () => {
        for (const entry of queued) {
          /*
           * Checked between files as well as inside the request, because a
           * cancel lands most often while one file is in flight and the rest
           * are still queued — aborting the transport alone would stop that
           * one file and then cheerfully start the next.
           */
          if (controller.signal.aborted) {
            break;
          }

          if (!entry.rejected) {
            await send(entry.task.id, entry.file, controller.signal);
          }
        }
      })();
    },
    [currentBatch, send],
  );

  /**
   * Stops the batch.
   *
   * Queued tiles are dropped outright rather than marked failed: they never
   * started, so there is nothing to report and nothing to retry. The file in
   * flight is aborted and removed by `send`. Everything already saved stays
   * saved — each upload is persisted on its own, so partial success needs no
   * work here, only the discipline not to undo it.
   */
  const cancel = useCallback((): void => {
    batch.current?.abort();
    batch.current = null;

    setTasks((previous) => {
      for (const task of previous) {
        if (task.status === 'queued') {
          filesById.current.delete(task.id);
        }
      }

      return previous.filter((task) => task.status !== 'queued');
    });

    /*
     * The held-back notice deliberately survives.
     *
     * It names files that were never in this batch — `splitBatch` dropped them
     * over the per-batch ceiling before anything started — and it is the only
     * record the vendor has of which ones. Clearing it on cancel would take
     * that list away as a side effect of stopping something unrelated.
     * `dismissAllFailed` clears it because that *is* the vendor tidying the
     * batch's aftermath; this is not.
     */
  }, []);

  const retryAll = useCallback((): void => {
    const retryable = tasks.filter(
      (task) => task.status === 'failed' && task.failure?.retryable === true,
    );

    const controller = currentBatch();

    void (async () => {
      for (const task of retryable) {
        if (controller.signal.aborted) {
          break;
        }

        const file = filesById.current.get(task.id);
        if (file) {
          await send(task.id, file, controller.signal);
        }
      }
    })();
  }, [currentBatch, send, tasks]);

  const dismiss = useCallback((id: string): void => {
    filesById.current.delete(id);
    setTasks((previous) => previous.filter((task) => task.id !== id));
  }, []);

  const dismissAllFailed = useCallback((): void => {
    setTasks((previous) => {
      for (const task of previous) {
        if (task.status === 'failed') {
          filesById.current.delete(task.id);
        }
      }
      return previous.filter((task) => task.status !== 'failed');
    });
    setHeldBackNotice(null);
  }, []);

  /*
   * #184. The `File` objects live in a ref and never enter state, so nothing
   * about an in-flight batch survives a navigation: the running XHR is killed,
   * everything queued behind it vanishes, and the vendor is shown no tile, no
   * banner and no record of which files were lost.
   *
   * Persisting them is not possible — a `File` is not serialisable, and the
   * comment on `filesById` says so. Warning is, and it is the honest option:
   * the browser asks, and the vendor decides whether the upload matters more
   * than wherever they were going.
   *
   * Only while something is actually in flight. `portfolio-manager` documents
   * leaving mid-upload as supported, and a guard that fires on an idle page
   * would be the papercut this is meant to prevent.
   */
  const inFlight = isBatchInFlight(tasks);

  useEffect(() => {
    if (!inFlight) {
      return;
    }

    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };

    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [inFlight]);

  return { tasks, heldBackNotice, inFlight, addFiles, retryAll, dismiss, dismissAllFailed, cancel };
}
