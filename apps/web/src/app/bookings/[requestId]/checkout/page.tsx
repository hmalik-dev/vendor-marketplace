import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { BRAND_NAME, pageTitle, uuidSchema } from '@vendor-marketplace/shared';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';
import { CheckoutScreen } from '@/components/checkout/checkout-screen';
import { getBookingForRequest, openCheckout } from '@/lib/customer-data';
import { requireRole } from '@/lib/current-user';

export const metadata: Metadata = {
  title: pageTitle('Secure checkout'),
  robots: { index: false, follow: false },
};

/** A live payment intent per visit; nothing here is cacheable. */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ requestId: string }>;
}

/**
 * Frame `05`. The screen that takes the money.
 *
 * The shell is **not** the app shell: `14-checkout.md` strips the header back to
 * the wordmark and one reassurance line, with no nav at all, because nothing on
 * this screen should compete with finishing. That is a deliberate exception to
 * the shared chrome rather than an oversight, and it is why the header is here
 * rather than in a layout.
 */
export default async function CheckoutPage({ params }: PageProps): Promise<React.ReactElement> {
  await requireRole('customer');
  const { requestId } = await params;

  /*
   * Parsed before it reaches a query, for the reason `web-route-boundaries.md`
   * gives: this URL is pasteable, and an id the API cannot parse is an
   * identifier that cannot exist — `notFound()`, never the 500 page.
   */
  const parsed = uuidSchema.safeParse(requestId);
  if (!parsed.success) {
    notFound();
  }

  /*
   * Already paid: there is nothing to take. Checked before opening checkout so
   * a customer who reloads the URL after paying lands on their confirmation
   * rather than on a card form for a booking they already hold.
   */
  const existing = await getBookingForRequest(parsed.data);
  if (existing) {
    redirect(`/bookings/${parsed.data}/confirmed`);
  }

  const checkout = await openCheckout(parsed.data);

  if (!checkout) {
    notFound();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-stone-100">
      <header className="flex h-(--header-height) flex-none items-center justify-between border-b border-stone-300 bg-stone-0 px-10">
        {/* No nav, and the wordmark is not a link — nothing leads away from here. */}
        <Logo size={LOGO_SIZES.authPanel} />
        <p className="flex items-center gap-2.25 text-[12.5px] text-stone-700">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-sage-500" />
          Secure checkout · encrypted by Stripe
        </p>
      </header>

      <main
        aria-label={`Checkout · ${BRAND_NAME}`}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <CheckoutScreen checkout={checkout} requestId={parsed.data} />
      </main>
    </div>
  );
}
