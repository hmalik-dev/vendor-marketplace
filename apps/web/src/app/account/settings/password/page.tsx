import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { SettingsLayout } from '@/components/account/settings-layout';
import { ACCOUNT_PASSWORD_PATH } from '@/components/account/settings-paths';
import { requireCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Change password'),
  robots: { index: false, follow: false },
};

/** Every role has a password, so this is `requireCurrentUser`, as the list is. */
export default async function ChangePasswordPage(): Promise<React.ReactElement> {
  const user = await requireCurrentUser(ACCOUNT_PASSWORD_PATH);

  return (
    <SettingsLayout title="Change password" backLink>
      <ChangePasswordForm role={user.role} />
    </SettingsLayout>
  );
}
