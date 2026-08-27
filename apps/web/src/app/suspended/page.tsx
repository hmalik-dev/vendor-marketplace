import type { Metadata } from 'next';
import { BRAND_NAME, pageTitle } from '@vendor-marketplace/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: pageTitle('Account suspended') };

/**
 * Where a suspended account lands. The API answers every request from a banned
 * user with 403, and without somewhere to send them each protected page threw
 * that error straight into the render and produced a raw 500. Ticket #15 owns
 * the admin tooling behind suspensions and can enrich this page then.
 */
export default function SuspendedPage(): React.ReactElement {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl font-semibold text-stone-800">
        Your account is suspended
      </h1>
      <p className="mt-4 text-stone-600">
        You cannot book or list services while this account is suspended. If you think this is a
        mistake, reply to any {BRAND_NAME} email and our team will take another look.
      </p>
      <Button variant="secondary" className="mt-8" asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
