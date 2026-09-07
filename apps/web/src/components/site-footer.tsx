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
import { cn } from '@/lib/utils';
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

/** One row of a footer column. */
interface FooterLinkSpec {
  href: string;
  label: string;
  /** Drawn at the hover weight and value at rest — see `COMPANY_LINKS`. */
  emphasis?: boolean;
}

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
  /*
   * `emphasis` is the frame singling this row out, not a decoration: both
   * footers in the closing-band frame in `design/delta-band/` draw every link at
   * `400 stone-520` and this one alone at `600 stone-50` — the resting state of
   * every other link's hover. It is the row a stuck reader needs, and the only
   * one in the footer that is a way *out* of a problem rather than a way
   * further in.
   */
  { href: SUPPORT_PATH, label: 'Contact support', emphasis: true },
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
const ACCOUNT_LINKS_BY_ROLE: Record<UserRole, readonly FooterLinkSpec[]> = {
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
/*
 * `text-action`, not `text-base` (#441). The frame draws the link columns and
 * the tagline at 13px, which is the `action` step — the size the frames give a
 * navigation action that is not a form control — where `base` is 13.5px.
 *
 * The micro-labels deliberately keep `text-label`'s 600 weight and 0.05em
 * tracking, against this frame's `500`/`0.07em`. `.lbl` is one shared
 * primitive, and **three** other bundles define it at 600/0.05em — the screens
 * document, `delta-legal` and `contact-support`. One frame against three
 * corroborating siblings is the outlier D30 describes, not a ladder step, and
 * `--tracking-label` is global. Raised as a frame correction, not built.
 *
 * **The size is set on the list, not on the link.** A row's height is its
 * `li`'s own line box, and an inline child does not shrink it: with `13px` on
 * the anchor alone the `ul` and `li` still computed `16px`/`normal`, so every
 * row was a 20px box holding a 16px anchor. The 11px gap was right and the
 * pitch was 31px against the frame's 27, which made the footer 25px taller than
 * it draws and left the legal row's copyright 1.5px off the links' baseline.
 * The frame sets its size on the container for exactly this reason.
 */
const LINK_CLASS =
  'text-stone-520 underline-offset-4 transition-colors duration-(--duration-fast) hover:text-stone-50 hover:underline';
/**
 * The frame's resting treatment for the one link it emphasises.
 *
 * Merged with `cn` rather than concatenated: `text-stone-50` and
 * `LINK_CLASS`'s `text-stone-520` are the same utility, and a class string's
 * order does not decide which wins — the generated stylesheet's does. Written
 * as `${LINK_CLASS} ${LINK_EMPHASIS_CLASS}` the row rendered at 600 weight in
 * the *unemphasised* colour, which is the half of the frame's distinction that
 * carries no meaning on its own.
 */
const LINK_EMPHASIS_CLASS = 'font-semibold text-stone-50';
const LEGAL_CLASS =
  'text-stone-560 underline-offset-4 transition-colors duration-(--duration-fast) hover:text-stone-50 hover:underline';

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
      <ul className="mt-3.5 flex flex-col gap-2.75 text-action">{children}</ul>
    </div>
  );
}

function FooterLink({ href, label, emphasis }: FooterLinkSpec): React.ReactElement {
  return (
    <li>
      <Link href={href} className={cn(LINK_CLASS, emphasis && LINK_EMPHASIS_CLASS)}>
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
      <div className="mx-auto w-full max-w-[1440px] px-5 py-10 lg:px-7 min-[90rem]:px-10">
        {/*
          `1.5fr 1fr 1fr 1fr` at 34px, not four quarters at 40px (#441).

          The brand column is wider than a link column because it holds a
          lockup and a sentence, and both footers in the frame draw it that
          way: at 1440 the ladder is 419/280/280/280 and `Browse` opens at
          x=493, where four quarters put it at 390. The `nav` spans the last
          three, and its own three columns are equal at the same 34px — which
          reproduces the outer ratio exactly, because 3fr plus two gaps is what
          the span is worth.
        */}
        <div className="grid gap-8.5 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            {/*
              `min-h-11` and the negative margin that pays for it: the lockup
              is 27px tall, and `04-laws.md` puts a 44x44 floor under a control
              whose accessible name comes from an `aria-label` rather than from
              text. It is grown the way Clerk's trigger is (`hit-area.test.ts`)
              — the target changes, the mark does not — and `-my-2` keeps the
              tagline where the frame draws it, 12px below.

              `min-w-11` changes nothing today: the wordmark already makes this
              link ~83px wide. It is the other half of a floor stated as 44x44,
              and it is what would still hold if this lockup ever dropped its
              wordmark for `variant="mark"`.
            */}
            <Link
              href="/"
              className="-my-2 inline-flex min-h-11 min-w-11 items-center transition-opacity hover:opacity-80"
            >
              <Logo size={LOGO_SIZES.marketingFooter} tone="dark" />
            </Link>
            <p className="mt-3 max-w-64 text-action leading-normal text-stone-560">
              {BRAND_TAGLINE}
            </p>
          </div>

          <nav aria-label="Footer" className="grid gap-8.5 sm:grid-cols-3 lg:col-span-3">
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
                    <button type="button" className={cn(LINK_CLASS, 'cursor-pointer text-left')}>
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

          `stone-50/10`, not `stone-0/10` (#441). The frame draws
          `rgba(248,245,239,.1)`, which is `stone-50` — the page background, one
          end of the same ramp the text on this ground reads from. `stone-0` is
          `#fffdf9`, a surface value, and at 10% over `stone-950` the two land
          close enough that the wrong one had survived since #428.
        */}
        <div
          data-slot="footer-legal"
          className="mt-6.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-stone-50/10 pt-4"
        >
          <ul className="flex gap-4.5 text-meta">
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
