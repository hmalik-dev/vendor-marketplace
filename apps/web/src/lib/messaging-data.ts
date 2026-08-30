import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ApiClientError, apiRequest } from './api-client';
import { isNavigationSignal } from './navigation-signal';
import { signInPathReturningHere } from './requested-path';
import {
  wireConversationListSchema,
  wireNotificationPageSchema,
  type WireConversation,
  type WireNotification,
} from './wire-schemas';

async function sessionToken(): Promise<string> {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    redirect(await signInPathReturningHere());
  }

  return token;
}

/**
 * Degrading to an empty list is right for a 500 or an unreachable API — the
 * screen's empty state is a designed surface and the live stream refills it.
 *
 * It is wrong for a **401**. The session has lapsed, and the reader is told
 * "No conversations yet" when the app simply could not read them: a designed
 * reassurance standing in for a failure, which is the one thing an empty state
 * must never do. `customer-data.ts` already separates the two; these did not,
 * and the inconsistency was the defect.
 */
async function redirectIfSignedOut(error: unknown): Promise<void> {
  if (isNavigationSignal(error)) {
    throw error;
  }

  if (error instanceof ApiClientError && error.statusCode === 401) {
    redirect(await signInPathReturningHere());
  }
}

/**
 * The caller's conversations. A failure costs the list rather than the page:
 * the screen's own empty state is a designed surface, and the live stream
 * refills it as soon as the API answers again.
 */
export async function getOwnConversations(): Promise<WireConversation[]> {
  const token = await sessionToken();

  try {
    return await apiRequest('/conversations', { schema: wireConversationListSchema, token });
  } catch (error) {
    await redirectIfSignedOut(error);

    return [];
  }
}

/** The first page of notifications, for the bell's initial badge and panel. */
export async function getOwnNotifications(): Promise<WireNotification[]> {
  const token = await sessionToken();

  try {
    const page = await apiRequest('/notifications', {
      schema: wireNotificationPageSchema,
      token,
    });

    return page.items;
  } catch (error) {
    await redirectIfSignedOut(error);

    return [];
  }
}
