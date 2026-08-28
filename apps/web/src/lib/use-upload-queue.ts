'use client';

import { useCallback, useRef, useState } from 'react';
import { ApiClientError } from './api-client';
import { useImageUpload, UploadTransportError } from './use-api';
import {
  connectionFailure,
  heldBackSentence,
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
  onUploaded: (stored: { imageUrl: string; thumbnailUrl: string | null }) => Promise<void>;
}

export interface UploadQueue {
  tasks: readonly UploadTask[];
  /** The gold batch-overflow line, or null. Cleared on the next selection. */
  heldBackNotice: string | null;
  addFiles: (files: readonly File[]) => void;
  /** Re-sends every failed file whose bytes are still good. */
  retryAll: () => void;
  /** Removes one settled tile — used after the vendor has read its reason. */
  dismiss: (id: string) => void;
  /** Clears every failed tile and the overflow notice at once. */
  dismissAllFailed: () => void;
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
    return rejectedFailure(error.message);
  }
  return connectionFailure();
}

export function useUploadQueue({ prefix, onUploaded }: UseUploadQueueOptions): UploadQueue {
  const upload = useImageUpload();
  const [tasks, setTasks] = useState<readonly UploadTask[]>([]);
  const [heldBackNotice, setHeldBackNotice] = useState<string | null>(null);

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
    async (id: string, file: File): Promise<void> => {
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

      try {
        const stored = await upload(file, prefix, {
          onProgress: (percent) => patch(id, { progress: percent }),
        });

        // The bytes are up but the row is not written yet, so the tile stays
        // in `uploading` until the caller has persisted it.
        patch(id, { progress: 100 });
        await onUploaded(stored);

        filesById.current.delete(id);
        patch(id, { status: 'done', progress: 100 });
      } catch (error) {
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
      void (async () => {
        for (const entry of queued) {
          if (!entry.rejected) {
            await send(entry.task.id, entry.file);
          }
        }
      })();
    },
    [send],
  );

  const retryAll = useCallback((): void => {
    const retryable = tasks.filter(
      (task) => task.status === 'failed' && task.failure?.retryable === true,
    );

    void (async () => {
      for (const task of retryable) {
        const file = filesById.current.get(task.id);
        if (file) {
          await send(task.id, file);
        }
      }
    })();
  }, [send, tasks]);

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

  return { tasks, heldBackNotice, addFiles, retryAll, dismiss, dismissAllFailed };
}
