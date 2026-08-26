import { redirect } from 'next/navigation';
import { DASHBOARD_PATH_BY_ROLE, requireCurrentUser } from '@/lib/current-user';

/**
 * Neutral landing spot after sign-in. Clerk redirects here without knowing the
 * user's role, so the role is resolved from the local record and the request is
 * forwarded to the matching dashboard.
 */
export default async function DashboardPage(): Promise<never> {
  const user = await requireCurrentUser();

  redirect(DASHBOARD_PATH_BY_ROLE[user.role]);
}
