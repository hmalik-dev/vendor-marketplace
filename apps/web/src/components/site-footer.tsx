import Link from 'next/link';

const FOOTER_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/sign-up', label: 'Become a vendor' },
  { href: '/sign-in', label: 'Sign in' },
] as const;

export function SiteFooter(): React.ReactElement {
  return (
    <footer className="mt-16 border-t border-stone-150 bg-stone-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="font-display text-lg font-semibold text-stone-800">VendorHub</p>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-stone-600 underline-offset-4 hover:text-stone-800 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="text-sm text-stone-500">Event vendors, booked without the back-and-forth.</p>
      </div>
    </footer>
  );
}
