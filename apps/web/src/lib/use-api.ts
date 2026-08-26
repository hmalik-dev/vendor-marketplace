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

export type ImageUploader = (
  file: File,
  prefix: string,
  signal?: AbortSignal,
) => Promise<UploadedImage>;

/**
 * Uploads one image and returns the stored variants. `fetch` has to set its own
 * multipart boundary, so this cannot go through `apiRequest`'s JSON path.
 */
export function useImageUpload(): ImageUploader {
  const { getToken } = useAuth();

  return useCallback(
    async (file, prefix, signal) => {
      const token = await getToken();

      const body = new FormData();
      body.append('file', file);

      const response = await fetch(
        `${BASE_URL}/upload/image?prefix=${encodeURIComponent(prefix)}`,
        {
          method: 'POST',
          headers: token ? { authorization: `Bearer ${token}` } : {},
          body,
          ...(signal ? { signal } : {}),
        },
      );

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const parsed = apiErrorSchema.safeParse(payload);
        throw parsed.success
          ? new ApiClientError(parsed.data.statusCode, parsed.data.error, parsed.data.message)
          : new ApiClientError(
              response.status,
              ERROR_CODES.INTERNAL_ERROR,
              `Upload failed with status ${response.status}`,
            );
      }

      const parsed = uploadedImageSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ApiClientError(
          response.status,
          ERROR_CODES.INTERNAL_ERROR,
          'Upload response did not match its schema',
        );
      }

      return parsed.data;
    },
    [getToken],
  );
}
