import Link from 'next/link';
import { Show } from '@clerk/nextjs';
import {
  BRAND_TAGLINE,
  LANDING_JUMP_CATEGORY_SLUGS,
  CATEGORY_SEEDS,
} from '@vendor-marketplace/shared';
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

/** The vendor links carry `?role=vendor` — see design/design-plan/21-sign-up.md. */
const COMPANY_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/sign-up?role=vendor', label: 'For vendors' },
];

/**
 * Both of these land on an authentication page, which bounces an
 * already-signed-in visitor straight back out — so they are only shown to
 * people who can actually use them.
 */
const SIGNED_OUT_LINKS = [
  { href: '/sign-up?role=vendor', label: 'Become a vendor' },
  { href: '/sign-in', label: 'Sign in' },
];

const SIGNED_IN_LINKS = [{ href: '/dashboard', label: 'Dashboard' }];

const COLUMN_HEADING = 'text-label font-semibold tracking-label text-stone-50/55 uppercase';
const LINK_CLASS =
  'text-base text-stone-50/78 underline-offset-4 transition-colors duration-(--duration-fast) hover:text-stone-50 hover:underline';

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
 * `stone-900` with cream text and four columns, per
 * design/design-plan/10-landing.md — the ink band that closes every marketing
 * page. The full-height app shells hide it entirely (see `globals.css`).
 */
export function SiteFooter(): React.ReactElement {
  return (
    // The split CTA above it is also ink, so the hairline is what keeps the
    // two from reading as one undifferentiated block on the landing page.
    <footer className="border-t border-stone-0/10 bg-stone-900">
      <div className="mx-auto w-full max-w-[1440px] px-5 py-14 sm:px-8 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:pr-10">
            <Link href="/" className="inline-block transition-opacity hover:opacity-80">
              <Logo size={LOGO_SIZES.marketingFooter} tone="dark" />
            </Link>
            <p className="mt-3.5 max-w-64 text-base leading-prose text-stone-50/78">
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
              {COMPANY_LINKS.map((link) => (
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
                {SIGNED_IN_LINKS.map((link) => (
                  <FooterLink key={link.href} {...link} />
                ))}
              </Show>
            </FooterColumn>
          </nav>
        </div>
      </div>
    </footer>
  );
}
