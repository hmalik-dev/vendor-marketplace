'use client';

import { useAuth } from '@clerk/nextjs';
import {
  apiErrorSchema,
  ERROR_CODES,
  uploadedImageSchema,
  type UploadedImage,
} from '@vendor-marketplace/shared';
import { useCallback } from 'react';
import { ApiClientError, apiRequest, type ApiRequestOptions } from './api-client';

export type BrowserRequestOptions<T> = Omit<ApiRequestOptions<T>, 'token'>;

export type BrowserRequest = <T>(path: string, options: BrowserRequestOptions<T>) => Promise<T>;

/** Browser calls need the absolute origin; server-only vars are unavailable here. */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * The browser-side counterpart to `getCurrentUser`. Client components cannot
 * read the Clerk session synchronously, so the token is fetched per call —
 * Clerk caches it and refreshes it when it is close to expiring, so a form
 * left open past the original token's lifetime still submits.
 */
export function useApi(): BrowserRequest {
  const { getToken } = useAuth();

  return useCallback(
    async <T>(path: string, options: BrowserRequestOptions<T>): Promise<T> => {
      const token = await getToken();
      return apiRequest(path, { ...options, token });
    },
    [getToken],
  );
}

export interface ImageUploadOptions {
  signal?: AbortSignal;
  /**
   * Called with 0–100 as the bytes go out. `40-states.md` allows determinate
   * progress only, and `fetch` cannot report upload progress at all — which is
   * why this path is `XMLHttpRequest` rather than the one `apiRequest` uses.
   */
  onProgress?: (percent: number) => void;
}

export type ImageUploader = (
  file: File,
  prefix: string,
  options?: ImageUploadOptions,
) => Promise<UploadedImage>;

/**
 * The network failure a dropped connection produces, kept distinct from a
 * server refusal: the bytes are still good, so the vendor is offered Retry
 * rather than Replace file.
 */
export class UploadTransportError extends Error {
  constructor() {
    super('The upload did not reach the server.');
    this.name = 'UploadTransportError';
  }
}

/** Reads the structured error body the API sends, tolerating a non-JSON page. */
function uploadError(status: number, rawBody: string): ApiClientError {
  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }

  const parsed = apiErrorSchema.safeParse(payload);
  return parsed.success
    ? new ApiClientError(parsed.data.statusCode, parsed.data.error, parsed.data.message)
    : new ApiClientError(
        status,
        ERROR_CODES.INTERNAL_ERROR,
        /*
         * A body that did not parse as an API error is not copy anyone wrote
         * for a reader, so `rejectedFailure` withholds it and supplies its own
         * sentence — this string is the log/debug line, and the status is the
         * one detail a support request would carry. Do not render it directly.
         */
        `The server would not take that file (${status}).`,
      );
}

/**
 * Uploads one image and returns the stored variants, reporting progress as it
 * goes. Multipart sets its own boundary, so this cannot go through
 * `apiRequest`'s JSON path either way.
 */
export function useImageUpload(): ImageUploader {
  const { getToken } = useAuth();

  return useCallback(
    async (file, prefix, options = {}) => {
      const { signal, onProgress } = options;

      /*
       * Checked before the token, and again below before the send.
       *
       * `AbortSignal` dispatches `abort` exactly once, at `abort()` time, so a
       * listener attached afterwards never runs — and the listener below is
       * attached after `await getToken()`, which is a network round trip
       * whenever Clerk refreshes. Without these two checks a cancel landing in
       * that window is silently lost: the request is sent anyway, the upload
       * succeeds, and the photo the vendor cancelled appears in their gallery.
       */
      /*
       * Read through a call, not a property access. `aborted` is live state
       * that changes underneath us, and TypeScript narrows a repeated property
       * read as though it could not — which turns the second check into a
       * compile error and, worse, invites deleting it.
       */
      const cancelled = (): boolean => signal?.aborted === true;

      if (cancelled()) {
        throw new UploadTransportError();
      }

      const token = await getToken();

      if (cancelled()) {
        throw new UploadTransportError();
      }

      const body = new FormData();
      body.append('file', file);

      return new Promise<UploadedImage>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', `${BASE_URL}/upload/image?prefix=${encodeURIComponent(prefix)}`);
        if (token) {
          request.setRequestHeader('authorization', `Bearer ${token}`);
        }

        if (onProgress) {
          request.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && event.total > 0) {
              onProgress(Math.round((event.loaded / event.total) * 100));
            }
          });
        }

        const abort = (): void => request.abort();
        signal?.addEventListener('abort', abort);

        request.addEventListener('loadend', () => {
          signal?.removeEventListener('abort', abort);

          // status 0 is the browser's report of a request that never completed
          // — offline, DNS, TLS, or an abort. None of them blame the file.
          if (request.status === 0) {
            reject(new UploadTransportError());
            return;
          }

          if (request.status < 200 || request.status >= 300) {
            reject(uploadError(request.status, request.responseText));
            return;
          }

          let payload: unknown = null;
          try {
            payload = JSON.parse(request.responseText);
          } catch {
            payload = null;
          }

          const parsed = uploadedImageSchema.safeParse(payload);
          if (!parsed.success) {
            reject(
              new ApiClientError(
                request.status,
                ERROR_CODES.INTERNAL_ERROR,
                'Upload response did not match its schema',
              ),
            );
            return;
          }

          resolve(parsed.data);
        });

        request.send(body);
      });
    },
    [getToken],
  );
}
