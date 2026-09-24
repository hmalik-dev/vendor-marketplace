import type { Metadata } from 'next';
import { closeOwnAccountReadinessSchema, pageTitle } from '@vendor-marketplace/shared';
import { notFound } from 'next/navigation';
import { CloseAccountForm } from '@/components/account/close-account-form';
import { SettingsLayout } from '@/components/account/settings-layout';
import { ACCOUNT_CLOSE_PATH } from '@/components/account/settings-paths';
import { apiRequest } from '@/lib/api-client';
import { getServerSession } from '@/lib/auth/server';
import { requireCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Close account'),
  robots: { index: false, follow: false },
};

/**
 * The Close account row's page (VEN-680). Customers and vendors only: an
 * operator's account is closed from the console, and the API refuses it here
 * too, so the page is a 404 for them rather than a form that cannot work.
 * The blockers are read on the server, so a person holding an upcoming
 * booking is told which before they are asked for a code.
 */
export default async function CloseAccountPage(): Promise<React.ReactElement> {
  const user = await requireCurrentUser(ACCOUNT_CLOSE_PATH);

  if (user.role === 'admin') {
    notFound();
  }

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
