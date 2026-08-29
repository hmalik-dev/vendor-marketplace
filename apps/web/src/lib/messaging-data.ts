import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { apiRequest } from './api-client';
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
 * The caller's conversations. A failure costs the list rather than the page:
 * the screen's own empty state is a designed surface, and the live stream
 * refills it as soon as the API answers again.
 */
export async function getOwnConversations(): Promise<WireConversation[]> {
  const token = await sessionToken();

  try {
    return await apiRequest('/conversations', { schema: wireConversationListSchema, token });
  } catch (error) {
    if (isNavigationSignal(error)) {
      throw error;
    }

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
    if (isNavigationSignal(error)) {
      throw error;
    }

    return [];
  }
}
