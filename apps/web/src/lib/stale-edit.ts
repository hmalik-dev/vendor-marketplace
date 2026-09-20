import { ApiClientError } from '@/lib/api-client';
import type { z } from 'zod';

/** What a form says when its save was refused because the row moved (VEN-481). */
export const STALE_EDIT_NOTICE =
  'This changed since you opened it. What you typed is still here; saving again replaces the current version.';

/**
 * The row as it stands now, when `error` is the API's stale-edit 409, else
 * `null`. The API carries it in `details.current`, so the form can rebase onto
 * its `updatedAt` without a second request.
 */
export function currentFromStaleEdit<T>(error: unknown, schema: z.ZodType<T>): T | null {
  if (!(error instanceof ApiClientError) || error.statusCode !== 409) {
    return null;
  }

  const details = error.details;
  if (typeof details !== 'object' || details === null || !('current' in details)) {
    return null;
  }

  const parsed = schema.safeParse(details.current);
  return parsed.success ? parsed.data : null;
}
