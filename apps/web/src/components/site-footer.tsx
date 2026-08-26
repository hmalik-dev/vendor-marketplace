import Link from 'next/link';
import { Show } from '@clerk/nextjs';

const HOME_LINK = { href: '/', label: 'Home' } as const;

/**
 * Both of these land on an authentication page, which now bounces an
 * already-signed-in visitor straight back out — so they are only shown to
 * people who can actually use them.
 */
const SIGNED_OUT_LINKS = [
  { href: '/sign-up', label: 'Become a vendor' },
  { href: '/sign-in', label: 'Sign in' },
] as const;

const LINK_CLASS = 'text-sm text-stone-600 underline-offset-4 hover:text-stone-800 hover:underline';

export function SiteFooter(): React.ReactElement {
  return (
    <footer className="mt-16 border-t border-stone-150 bg-stone-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="font-display text-lg font-semibold text-stone-800">VendorHub</p>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href={HOME_LINK.href} className={LINK_CLASS}>
            {HOME_LINK.label}
          </Link>

          <Show when="signed-out">
            {SIGNED_OUT_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={LINK_CLASS}>
                {link.label}
              </Link>
            ))}
          </Show>
        </nav>

        <p className="text-sm text-stone-500">Event vendors, booked without the back-and-forth.</p>
      </div>
    </footer>
  );
}
