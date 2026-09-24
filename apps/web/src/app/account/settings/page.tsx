import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import {
  SettingsLayout,
  SettingsRows,
  type SettingsRowData,
} from '@/components/account/settings-layout';
import {
  ACCOUNT_CLOSE_PATH,
  ACCOUNT_NAME_PATH,
  ACCOUNT_PASSWORD_PATH,
  ACCOUNT_SESSIONS_PATH,
  ACCOUNT_SETTINGS_PATH,
  SETTINGS_SAVED_COPY,
  SETTINGS_SAVED_PARAM,
} from '@/components/account/settings-paths';
import { AUTH_COPY } from '@/app/auth-copy';
import { Banner } from '@/components/ui/banner';
import { requireCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Account settings'),
  robots: { index: false, follow: false },
};

/**
 * The account settings list (VEN-703): one row per setting a person has, the
 * same for every role, each opening its own page under `/account/settings/`.
 * A later setting (email, sessions, closing the account) is one more entry in
 * `rows` and one more route — nothing here is redesigned.
 *
 * `requireCurrentUser` rather than `requireRole`: every role has a name and a
 * password, so nothing is bounced, and a signed-out visitor is sent to sign in
 * and back.
 */
export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const user = await requireCurrentUser(ACCOUNT_SETTINGS_PATH);
  const saved = (await searchParams)[SETTINGS_SAVED_PARAM];
  // `hasOwn`: a bare lookup would answer `?saved=__proto__` with an object React cannot render.
  const confirmation =
    typeof saved === 'string' && Object.hasOwn(SETTINGS_SAVED_COPY, saved)
      ? SETTINGS_SAVED_COPY[saved]
      : undefined;

  const rows: SettingsRowData[] = [
    {
      id: 'name',
      label: 'Your name',
      value: `${user.firstName} ${user.lastName}`.trim(),
      href: ACCOUNT_NAME_PATH,
    },
    { id: 'password', label: 'Password', value: '••••••••••', href: ACCOUNT_PASSWORD_PATH },
    {
      id: 'sessions',
      label: AUTH_COPY.sessionsTitle,
      value: AUTH_COPY.sessionsRowValue,
      href: ACCOUNT_SESSIONS_PATH,
    },
  ];

  // An admin account is closed from the console, which keeps its own guards.
  if (user.role !== 'admin') {
    rows.push({
      id: 'close',
      label: 'Close account',
      value: 'Retire your account and sign out everywhere',
      href: ACCOUNT_CLOSE_PATH,
    });
  }

  return (
    <SettingsLayout title="Account settings">
      {confirmation ? (
        <Banner status="settled" role="status" className="mb-6">
          {confirmation}
        </Banner>
      ) : null}
      <SettingsRows rows={rows} />
    </SettingsLayout>
  );
}
