'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Attaches the signed-in user id to browser error reports, and clears it
 * on sign-out. Only the id: the scrubbing hook would strip an email anyway, and
 * never handing one over is the stronger half of that guarantee. The API
 * reports the same id, so one person reads as one user across both
 * projects. The id comes from the server-read session, so it is right on first paint.
 */
export function ErrorReportingUser({ userId }: { userId: string | null }): null {
  useEffect(() => {
    Sentry.setUser(userId ? { id: userId } : null);
  }, [userId]);

  return null;
}
