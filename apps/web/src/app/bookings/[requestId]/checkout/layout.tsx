import { BRAND_NAME } from '@vendor-marketplace/shared';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';
import { SAGE_DOT } from '@/components/checkout/checkout-screen';

/**
 * Frame `05`'s shell: the wordmark, one reassurance line, and no nav at all.
 *
 * `14-checkout.md` strips the chrome back to this because nothing on the screen
 * that takes the money should compete with finishing, and `public-chrome.tsx`
 * takes the marketplace header off this route so the two do not stack.
 *
 * **It is a layout rather than markup in `page.tsx`, and that is the whole
 * point.** A layout wraps the segment's `not-found` and `error` boundaries as
 * well as its page, so every render at this URL has the header the route
 * promises. With the header inside the page, a stale checkout link — a valid
 * uuid for a request that no longer exists — rendered frame `15` with the shell
 * header already suppressed and no header of its own: a 404 on bare ground,
 * against that screen's own stated contract that the shell stays up.
 */
export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex min-h-dvh flex-col bg-stone-50">
      <header className="flex h-(--header-height) flex-none items-center justify-between border-b border-stone-300 bg-stone-0 px-8">
        {/*
          The wordmark is not a link — nothing leads away from here.

          `desktopHeader`, not `authPanel`: frame `05` line 878 draws 15px
          circles on this bar, the same mark the app shell wears. The 19px panel
          size belongs to the sign-in card, where the wordmark is the screen's
          own masthead rather than a corner mark.
        */}
        <Logo size={LOGO_SIZES.desktopHeader} />
        <p className="flex items-center gap-2.25 text-sm text-stone-700">
          <span aria-hidden="true" className={SAGE_DOT} />
          Secure checkout · encrypted by Stripe
        </p>
      </header>

      {/*
        A labelled region, not a second `<main>`. The root layout owns the
        page's one `main#main` landmark, and nesting another inside it announced
        two main regions and made every `role=main` locator ambiguous.
        `<section>` keeps the name this area had without claiming the landmark
        twice.
      */}
      <section
        aria-label={`Checkout · ${BRAND_NAME}`}
        className="flex flex-1 flex-col overflow-hidden"
      >
        {children}
      </section>
    </div>
  );
}
