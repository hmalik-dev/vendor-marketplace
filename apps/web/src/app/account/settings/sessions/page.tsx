import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { AUTH_COPY } from '@/app/auth-copy';
import { SessionsList } from '@/components/account/sessions-list';
import { SettingsLayout } from '@/components/account/settings-layout';
import { ACCOUNT_SESSIONS_PATH } from '@/components/account/settings-paths';
import { requireCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle(AUTH_COPY.sessionsTitle),
  robots: { index: false, follow: false },
};

/** Every role signs in, so this is `requireCurrentUser`, as the rest of settings is. */
export default async function SessionsPage(): Promise<React.ReactElement> {
  await requireCurrentUser(ACCOUNT_SESSIONS_PATH);

  return (
    <SettingsLayout title={AUTH_COPY.sessionsTitle} backLink>
      <SessionsList />
    </SettingsLayout>
  );
}
