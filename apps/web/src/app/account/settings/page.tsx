import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { requireCurrentUser } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Account settings'),
  robots: { index: false, follow: false },
};

/**
 * The account settings area (VEN-677, ruled by the account holder): one page
 * every signed-in role reaches from the account menu, built as a list of
 * sections so later settings join it rather than growing new routes. Password
 * is the first and, for now, only section.
 *
 * `requireCurrentUser` rather than `requireRole`: every role has a password,
 * so nothing is bounced, and a signed-out visitor is sent to sign in and back.
 * Changing an email or closing an account stays behind `Contact support`
 * (D39) — see `account-menu.tsx`.
 *
 * No frame draws it; `00-README.md` records it as derived from frame `12`'s
 * field and button vocabulary.
 */
export default async function AccountSettingsPage(): Promise<React.ReactElement> {
  await requireCurrentUser('/account/settings');

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-10 pb-16">
      <h1 className="font-display text-[33px] leading-[1.1] text-stone-900">Account settings</h1>

      <section aria-labelledby="password-heading" className="mt-8 border-t border-stone-300 pt-6">
        <h2 id="password-heading" className="mb-4 text-lg font-semibold text-stone-900">
          Password
        </h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
