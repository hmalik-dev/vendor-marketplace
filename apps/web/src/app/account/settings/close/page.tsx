import type { Metadata } from 'next';
import { closeOwnAccountReadinessSchema, pageTitle } from '@vendor-marketplace/shared';
import { CloseAccountForm } from '@/components/account/close-account-form';
import { SettingsLayout } from '@/components/account/settings-layout';
import { ACCOUNT_CLOSE_PATH } from '@/components/account/settings-paths';
import { apiRequest } from '@/lib/api-client';
import { getServerSession } from '@/lib/auth/server';
import { requireNonAdmin } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Close account'),
  robots: { index: false, follow: false },
};

/**
 * The Close account row's page (VEN-680). Customers and vendors only: an
 * admin account is closed from the console, and the API refuses it here
 * too, so `requireNonAdmin` sends an admin to their console rather than
 * offering a form that cannot work.
 * The blockers are read on the server, so a person holding an upcoming
 * booking is told which before they are asked for a code.
 */
export default async function CloseAccountPage(): Promise<React.ReactElement> {
  const user = await requireNonAdmin(ACCOUNT_CLOSE_PATH);

  const token = (await getServerSession())?.token ?? null;
  const { blockers } = await apiRequest('/users/me/close', {
    schema: closeOwnAccountReadinessSchema,
    token,
  });

  return (
    <SettingsLayout title="Close account" backLink>
      <CloseAccountForm role={user.role} email={user.email} blockers={blockers} />
    </SettingsLayout>
  );
}
