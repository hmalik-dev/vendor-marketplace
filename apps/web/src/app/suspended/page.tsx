import type { Metadata } from 'next';
import { pageTitle, SUPPORT_PATH } from '@vendor-marketplace/shared';
import Link from 'next/link';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { readSuspendedRole } from '@/lib/current-user';

export const metadata: Metadata = { title: pageTitle('Account suspended') };

/**
 * Where a suspended account lands. The API answers every request from a banned
 * user with 403, and without somewhere to send them each protected page threw
 * that error straight into the render and produced a raw 500.
 *
 * Frame 53. `data-auth-screen` takes the site header and footer off, and the
 * page draws the frame's own header: the mark and `Sign out`, nothing that
 * suggests another route works. `/support` is exempt from the suspension
 * redirect, so `Contact support` is a real way out.
 *
 * The refund sentence is for vendors only (VEN-763): suspension refunds a
 * vendor's confirmed bookings, and telling a customer the same would be false.
 * The role comes from the API's suspension refusal, since `/users/me` answers
 * a banned account with that refusal and nothing else.
 */
export default async function SuspendedPage(): Promise<React.ReactElement> {
  const role = await readSuspendedRole();

  return (
    <div data-auth-screen className="flex min-h-dvh flex-col bg-stone-50">
      <header className="flex h-(--header-height) flex-none items-center justify-between border-b border-stone-300 bg-stone-0 px-8">
        {/* Not a link: every route but `/support` would bounce straight back here. */}
        <Logo size={LOGO_SIZES.desktopHeader} />
        <SignOutButton>
          <button
            type="button"
            className="text-[13.5px] font-semibold text-clay-500 hover:text-clay-600 hover:underline"
          >
            Sign out
          </button>
        </SignOutButton>
      </header>

      <section
        aria-labelledby="suspended-heading"
        className="flex flex-1 flex-col items-center justify-center px-10 text-center"
      >
        <div
          aria-hidden="true"
          className="mb-5.5 flex size-11.5 items-center justify-center rounded-full bg-stone-200"
        >
          <div className="size-4 rounded-full border-2 border-stone-600" />
        </div>
        <h1
          id="suspended-heading"
          className="display-heading mb-3 text-display-error text-stone-900"
        >
          Your account is suspended
        </h1>
        <p className="mb-6 max-w-[480px] text-sm leading-[1.65] text-stone-700">
          You can’t book, message or take bookings while it’s suspended.
          {role === 'vendor' ? ' Confirmed bookings were refunded to customers in full.' : null}
        </p>
        <div data-testid="suspended-actions" className="flex gap-3">
          <Button variant="primary" asChild>
            <Link href={SUPPORT_PATH}>Contact support</Link>
          </Button>
          <SignOutButton>
            <Button variant="secondary">Sign out</Button>
          </SignOutButton>
        </div>
      </section>
    </div>
  );
}
