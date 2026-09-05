import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ApiClientError, apiRequest } from './api-client';
import { isNavigationSignal } from './navigation-signal';
import { reportSwallowedError } from './report-error';
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
 * The caller's conversations, and whether the read failed (#402).
 *
 * The two were indistinguishable: a failure returned `[]`, so `/messages`
 * rendered "No conversations yet" — a statement about the reader's inbox — over
 * an API that was simply down. A browser pass saw exactly that and it is the
 * `#368` class in full, on the one screen where the list *is* the content.
 *
 * A failure still costs the list rather than the page, because the live stream
 * refills it as soon as the API answers again. What changes is that the screen
 * is told, and can say so instead of speaking for the database.
 */
export async function loadOwnConversations(): Promise<{
  conversations: WireConversation[];
  failed: boolean;
}> {
  const token = await sessionToken();

  try {
    const conversations = await apiRequest('/conversations', {
      schema: wireConversationListSchema,
      token,
    });

    return { conversations, failed: false };
  } catch (error) {
    await redirectIfSignedOut(error);
    reportSwallowedError('messages: loading the conversation list failed', error);

    return { conversations: [], failed: true };
  }
}

/**
 * The same read for the surfaces where the list is a supplementary band.
 *
 * Frame `07`'s bookings rail draws three rows beside the booking it is about;
 * an outage there costs the band, and the page it sits on still stands on its
 * own. Only `/messages`, where the list is the whole screen, needs to know.
 */
export async function getOwnConversations(): Promise<WireConversation[]> {
  const { conversations } = await loadOwnConversations();

  return conversations;
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
