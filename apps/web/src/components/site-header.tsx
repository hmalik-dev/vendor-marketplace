import Link from 'next/link';
import { Show, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

/**
 * Global site header. Server Component — Clerk's control components resolve
 * auth state on the server, so no 'use client' boundary is needed here.
 */
export function SiteHeader(): React.ReactElement {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-stone-800 transition-opacity hover:opacity-80"
        >
          VendorHub
        </Link>

        <div className="flex items-center gap-2">
          <Show when="signed-out">
            {/*
              Both routes are full pages rather than modals: sign-up has to
              collect the customer/vendor role before Clerk's form renders.
            */}
            <Button variant="ghost" size="cta" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button variant="cta" size="cta" asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </Show>

          <Show when="signed-in">
            <Button variant="ghost" size="cta" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserButton />
          </Show>
        </div>
      </nav>
    </header>
  );
}
