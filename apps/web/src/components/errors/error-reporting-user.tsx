'use client';

import { useAuth } from '@clerk/nextjs';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Attaches the signed-in Clerk user id to browser error reports, and clears it
 * on sign-out. Only the id: the scrubbing hook would strip an email anyway, and
 * never handing one over is the stronger half of that guarantee. The API
 * reports the same Clerk id, so one person reads as one user across both
 * projects.
 */
export function ErrorReportingUser(): null {
  const { userId } = useAuth();

  useEffect(() => {
    Sentry.setUser(userId ? { id: userId } : null);
  }, [userId]);

  return null;
}
