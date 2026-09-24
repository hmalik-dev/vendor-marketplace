import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { ChangeNameForm } from '@/components/account/change-name-form';
import { SettingsLayout } from '@/components/account/settings-layout';
import { ACCOUNT_NAME_PATH } from '@/components/account/settings-paths';
import { requireCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Your name'),
  robots: { index: false, follow: false },
};

export default async function ChangeNamePage(): Promise<React.ReactElement> {
  const user = await requireCurrentUser(ACCOUNT_NAME_PATH);

  return (
    <SettingsLayout title="Your name" backLink>
      <ChangeNameForm firstName={user.firstName} lastName={user.lastName} />
    </SettingsLayout>
  );
}
