'use client';

import {
  apiErrorSchema,
  ERROR_CODES,
  uploadedImageSchema,
  type UploadedImage,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { apiOrigin } from '@/config/public-env';
import { clearSessionToken, getSessionToken } from './auth/client';
import { ApiClientError, apiRequest, type ApiRequestOptions } from './api-client';
import { signInPathReturningTo } from './return-path';
import {
  isGateExemptPath,
  isRefusalExemptPath,
  isTermsRequired,
  termsAcceptancePath,
  terminalRefusal,
} from './terms-gate-paths';

export type BrowserRequestOptions<T> = Omit<ApiRequestOptions<T>, 'token'>;

export type BrowserRequest = <T>(path: string, options: BrowserRequestOptions<T>) => Promise<T>;

/** Browser calls need the absolute origin; server-only vars are unavailable here. */
const BASE_URL = apiOrigin();

const SUSPENDED_PATH = '/suspended';

/** Where a refusal is already being answered, so leaving again would loop. */
const REFUSAL_HOME_PREFIXES = [SUSPENDED_PATH, '/sign-in', '/sign-up', '/after-sign-in'] as const;

export type RefusalRedirect = (error: unknown) => boolean;

/**
 * The mid-session refusal, handled once for every client call and the live
 * stream: a suspension (403) goes to `/suspended`, a session the API no longer
 * honours (401) forgets its cached token and goes to sign-in carrying the
 * current path. `terminalRefusal` decides which; this only navigates.
 *
 * Returns whether the error was such a refusal, so a caller with its own
 * fallback (the stream's "Reconnecting" banner) can tell. It does not navigate
 * from `isRefusalExemptPath` or from the refusal's own destinations — a
 * narrower list than the Terms funnel's, because a real 401 or suspension on
 * a page a gated account only *browses* still has to redirect (`terms-gate-paths.ts`).
 * The identity is stable, so an effect may depend on it.
 */
export function useRefusalRedirect(): RefusalRedirect {
  const router = useRouter();

  return useCallback(
    (error: unknown): boolean => {
      const refusal = terminalRefusal(error);

      /*
       * `terminalRefusal` reads every 403 that is not the gate as a suspension,
       * which suits the one screen and the server reads it was written for. Here
       * it would judge every call, and a stale tab's Accept or a vendor on a
       * moderation hold is a 403 too — telling them they are banned. Only the
       * API's own suspension code is terminal on this path.
       */
      if (
        refusal === null ||
        (refusal === 'suspended' &&
          !(error instanceof ApiClientError && error.code === ERROR_CODES.ACCOUNT_SUSPENDED))
      ) {
        return false;
      }

      const { pathname, search } = window.location;

      if (
        isRefusalExemptPath(pathname) ||
        REFUSAL_HOME_PREFIXES.some((prefix) => pathname.startsWith(prefix))
      ) {
        return true;
      }

      if (refusal === 'suspended') {
        router.replace(SUSPENDED_PATH);
      } else {
        clearSessionToken();
        window.location.assign(signInPathReturningTo(pathname + search));
      }

      return true;
    },
    [router],
  );
}

/**
 * The browser-side counterpart to `getCurrentUser`. Client components cannot
 * read the session synchronously, so the token is fetched per call —
 * `getSessionToken` caches it and refreshes it when it is close to expiring, so a form
 * left open past the original token's lifetime still submits.
 */
export function useApi(): BrowserRequest {
  const router = useRouter();
  const redirectOnRefusal = useRefusalRedirect();

  return useCallback(
    async <T>(path: string, options: BrowserRequestOptions<T>): Promise<T> => {
      const token = await getSessionToken();

      try {
        return await apiRequest(path, { ...options, token });
      } catch (error) {
        /*
         * The acceptance gate (#429), handled once for every client call rather
         * than in each `catch`.
         *
         * A session that has not accepted the current Terms is refused by every
         * guarded route, so no caller here has a sensible alternative to sending
         * the reader to the interstitial — and several would otherwise report
         * the refusal as something it is not: the vendor profile's message
         * button reads a 403 as "only a customer account can start a thread",
         * which is a wrong and unfixable answer to give somebody who is one tick
         * away from being able to. The error is still thrown so the caller's own
         * cleanup runs; the navigation is already under way.
         *
         * **Except on the pages the gate must not take away.** This funnel is
         * ambient — `NotificationBell` is mounted by the root layout and fetches
         * on mount — so without the exemption a gated reader who opens `/terms`
         * in its own tab, from the link beside the very checkbox, is pushed back
         * to the gate a round trip later. `/support` is the same case and worse:
         * the person most likely to need it is the one who cannot get through.
         */
        if (isTermsRequired(error) && !isGateExemptPath(window.location.pathname)) {
          router.push(termsAcceptancePath(window.location.pathname + window.location.search));
        }

        redirectOnRefusal(error);

        throw error;
      }
    },
    [redirectOnRefusal, router],
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
  return useCallback(async (file, prefix, options = {}) => {
    const { signal, onProgress } = options;

    /*
     * Checked before the token, and again below before the send.
     *
     * `AbortSignal` dispatches `abort` exactly once, at `abort()` time, so a
     * listener attached afterwards never runs — and the listener below is
     * attached after `await getSessionToken()`, which is a network round trip
     * whenever the cache refreshes. Without these two checks a cancel landing in
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

    const token = await getSessionToken();

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
  }, []);
}
