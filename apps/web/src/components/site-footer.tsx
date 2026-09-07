import Link from 'next/link';
import { Show, SignOutButton } from '@clerk/nextjs';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  LANDING_JUMP_CATEGORY_SLUGS,
  CATEGORY_SEEDS,
  SUPPORT_PATH,
} from '@vendor-marketplace/shared';
import type { UserRole } from '@vendor-marketplace/shared';
import { readRoleForChrome } from '@/lib/current-user';
import { DASHBOARD_LABEL_BY_ROLE } from '@/lib/role-routes';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';

/**
 * The line the whole brand is aimed at. It is about the vendors, not the
 * platform — see design/design-plan/10-landing.md.
 */

/** The same four categories the hero jumps to, so the two agree. */
const BROWSE_LINKS = [
  ...LANDING_JUMP_CATEGORY_SLUGS.map((slug) => ({
    href: `/search?category=${slug}`,
    label: CATEGORY_SEEDS.find((seed) => seed.slug === slug)?.name ?? slug,
  })),
  { href: '/search', label: 'All vendors' },
];

/**
 * The vendor links carry `?role=vendor` — see design/design-plan/21-sign-up.md.
 *
 * `Contact support` sits here rather than in Account because it is true for
 * everyone: it is the one row of this footer a signed-out visitor and a
 * suspended vendor both need, and Account is the column that changes under
 * them. The destination is frame `29` — a real screen, not a placeholder —
 * so nothing here reads as a working channel that is not one.
 */
const COMPANY_LINKS = [
  { href: '/sign-up?role=vendor', label: 'For vendors' },
  { href: SUPPORT_PATH, label: 'Contact support' },
];

/**
 * `How it works` is an **anchor**, so it is only a link for a reader who has
 * the section to land on — and two roles do not.
 *
 * A signed-in customer's `/` drops that section (#428): the process is one they
 * have completed, so it comes off their landing, and the footer renders on
 * every route, which made this the one control still pointing at it. A vendor
 * never reaches `/` at all — `redirectVendorToDashboard` sends them to their own
 * dashboard — so for them it has always been a link that silently goes
 * somewhere else, and it goes now with the customer's.
 *
 * A signed-out visitor and an operator both render the section and keep it.
 * Written as the roles that *lose* it, because that is the question being
 * asked: not "who is signed in" but "for whom does the target exist".
 */
const ROLES_WITHOUT_HOW_IT_WORKS: readonly UserRole[] = ['customer', 'vendor'];
const HOW_IT_WORKS_LINK = { href: '/#how-it-works', label: 'How it works' };

/**
 * Both of these land on an authentication page, which bounces an
 * already-signed-in visitor straight back out — so they are only shown to
 * people who can actually use them.
 *
 * **`Dashboard` is deliberately absent**: a visitor has no dashboard, and this
 * column is the one place the footer could offer them one. Frame
 * `30 Landing full page — signed in` draws these two and nothing else.
 *
 * It read `Become a vendor` beside `Sign in`, which is the vendor door said
 * twice: Company already carries `For vendors`, at the same destination, one
 * column to the left. The plain `Sign up` is what the frame draws, and it is
 * also the honest label — `/sign-up`'s role cards are the fork, not this link
 * (design/design-plan/21-sign-up.md).
 */
const SIGNED_OUT_LINKS = [
  { href: '/sign-in', label: 'Sign in' },
  { href: '/sign-up', label: 'Sign up' },
];

/**
 * The reader's own surfaces, per role — the Account column once there is an
 * account behind it.
 *
 * Frame `30` draws four rows for a customer where this column used to draw one,
 * and the reason is what the column is *for*: signed out it is the way in, and
 * signed in it is the way back to your own things. The other two roles get the
 * same shape against their own surfaces.
 *
 * Every label here is the word the reader already meets on the surface it leads
 * to — `My bookings` and `My profile` are the customer sidebar's own rows, and
 * `Dashboard` is what frame `08` puts on the first row of the vendor's rail. A
 * fourth word for a destination that already has one is how a control comes to
 * be called two things (#372), and on the customer's side `Dashboard`
 * specifically is forbidden outright: `20-customer-bookings-hub.md`'s
 * acceptance is *"the word 'dashboard' appears nowhere in the UI"*.
 *
 * An operator gets the console and nothing else. `/messages` and a profile are
 * customer-and-vendor surfaces; an admin has neither, and offering them rows
 * that bounce would be worse than a short column.
 */
const ACCOUNT_LINKS_BY_ROLE: Record<UserRole, readonly { href: string; label: string }[]> = {
  customer: [
    { href: '/bookings', label: 'My bookings' },
    { href: '/messages', label: 'Messages' },
    { href: '/customer/profile', label: 'My profile' },
  ],
  vendor: [
    { href: '/dashboard', label: DASHBOARD_LABEL_BY_ROLE.vendor },
    { href: '/messages', label: 'Messages' },
    { href: '/vendor/profile/edit', label: 'Edit profile' },
  ],
  admin: [{ href: '/dashboard', label: DASHBOARD_LABEL_BY_ROLE.admin }],
};

/**
 * The legal row, and the reason it is a row rather than a fifth column.
 *
 * A column would give three links the same visual weight as Browse, which is
 * the whole catalogue. These are the pages Stripe Connect onboarding asks for
 * the URLs of and that nobody reads twice — see frame `31 Terms of Service`.
 */
const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
];

/**
 * The year the notice claims, resolved once per render rather than written out.
 *
 * A literal year is wrong from the first of January and nothing fails when it
 * becomes so.
 */
function copyrightYear(): number {
  return new Date().getFullYear();
}

/*
 * All three read a token rather than an alpha of `stone-50`.
 *
 * The alphas were an approximation of two values the frames name outright, and
 * on the new ground they land a step light and off-hue — `stone-50/78` over
 * `stone-950` is `#c7c2b6` where the frame draws `#b8af9f`. `theme.css` carries
 * the derivation and `theme-tokens.test.ts` the contrast, including why the
 * label may not go darker than `stone-560`.
 */
const COLUMN_HEADING = 'text-label font-semibold tracking-label text-stone-560 uppercase';
const LINK_CLASS =
  'text-base text-stone-520 underline-offset-4 transition-colors duration-(--duration-fast) hover:text-stone-50 hover:underline';
const LEGAL_CLASS =
  'text-meta text-stone-560 underline-offset-4 transition-colors duration-(--duration-fast) hover:text-stone-50 hover:underline';

function FooterColumn({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <p className={COLUMN_HEADING}>{heading}</p>
      <ul className="mt-3.5 flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, label }: { href: string; label: string }): React.ReactElement {
  return (
    <li>
      <Link href={href} className={LINK_CLASS}>
        {label}
      </Link>
    </li>
  );
}

/**
 * Four columns and a legal row on `stone-950`, per
 * design/design-plan/10-landing.md and frame `30` — the chrome that closes
 * every marketing page. The full-height app shells hide it entirely (see
 * `globals.css`).
 */
export async function SiteFooter(): Promise<React.ReactElement> {
  /*
   * Read here rather than threaded from the layout: the footer is rendered by
   * `PublicChrome`, a Client Component that knows the pathname and nothing
   * about the reader. `readRoleForChrome` never throws and returns before it
   * makes a request when signed out, so a marketing page pays nothing for it —
   * the same contract the header relies on.
   */
  const role = await readRoleForChrome();
  /*
   * `null` is a signed-out visitor **or** an account record that could not be
   * read, and the two columns want different things from that ambiguity.
   *
   * Account falls back to the customer's set, because the `Show` around it has
   * already established there is a session and the customer is the
   * overwhelmingly common one. Company must not: the fallback would take
   * `How it works` away from every signed-out visitor, who is exactly the
   * reader the section is written for. So the anchor is dropped only for a role
   * that was actually read and actually loses the target.
   */
  const accountLinks = ACCOUNT_LINKS_BY_ROLE[role ?? 'customer'];
  const companyLinks =
    role !== null && ROLES_WITHOUT_HOW_IT_WORKS.includes(role)
      ? COMPANY_LINKS
      : [HOW_IT_WORKS_LINK, ...COMPANY_LINKS];

  return (
    /*
     * `stone-950`, one step below the ink of the closing band above it.
     *
     * This carried a hairline on `stone-900`, on the reasoning that the hairline
     * was what kept the band and the footer from reading as one block. It was
     * not enough: two masses of the same ink separated by a rule read as one
     * 400px dark region with a line in it. The value drop does the separating —
     * the band stays the last piece of *content*, and the footer recedes into
     * chrome under it — so the rule comes off with it.
     */
    <footer data-slot="site-footer" className="bg-stone-950">
      {/* Same gutter ladder as the page and the header — see `page.tsx`. */}
      <div className="mx-auto w-full max-w-[1440px] px-5 py-14 lg:px-7 min-[90rem]:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:pr-10">
            <Link href="/" className="inline-block transition-opacity hover:opacity-80">
              <Logo size={LOGO_SIZES.marketingFooter} tone="dark" />
            </Link>
            <p className="mt-3.5 max-w-64 text-base leading-prose text-stone-560">
              {BRAND_TAGLINE}
            </p>
          </div>

          <nav aria-label="Footer" className="grid gap-10 sm:grid-cols-3 lg:col-span-3">
            <FooterColumn heading="Browse">
              {BROWSE_LINKS.map((link) => (
                <FooterLink key={link.href} {...link} />
              ))}
            </FooterColumn>

            <FooterColumn heading="Company">
              {companyLinks.map((link) => (
                <FooterLink key={link.href} {...link} />
              ))}
            </FooterColumn>

            <FooterColumn heading="Account">
              <Show when="signed-out">
                {SIGNED_OUT_LINKS.map((link) => (
                  <FooterLink key={link.href} {...link} />
                ))}
              </Show>
              <Show when="signed-in">
                {accountLinks.map((link) => (
                  <FooterLink key={link.href} {...link} />
                ))}
                <li>
                  {/*
                    Clerk's own control rather than a link to a route: signing
                    out is a session mutation, and the `UserButton` in the header
                    is a menu behind an avatar — this column is where a reader
                    who wants out actually looks. `className` rather than a
                    nested element, so there is one focusable control here and
                    not a button wrapping a button.
                  */}
                  <SignOutButton>
                    <button type="button" className={`${LINK_CLASS} cursor-pointer text-left`}>
                      Sign out
                    </button>
                  </SignOutButton>
                </li>
              </Show>
            </FooterColumn>
          </nav>
        </div>

        {/*
          The legal row — a row, never a fifth column.

          Frame `30` draws it under the grid at 26px, over a 16px-padded rule
          that is the only hairline left in this footer now that the top border
          has gone.
        */}
        <div className="mt-6.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-stone-0/10 pt-4">
          <ul className="flex gap-4.5">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LEGAL_CLASS}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          {/* The wordmark is read, never written out. */}
          <p className="text-meta text-stone-560">{`© ${BRAND_NAME} ${copyrightYear()}`}</p>
        </div>
      </div>
    </footer>
  );
}
