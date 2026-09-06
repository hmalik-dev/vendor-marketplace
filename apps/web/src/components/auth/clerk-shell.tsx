'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ui } from '@clerk/ui';
import { shadcn } from '@clerk/ui/themes';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { CLERK_COPY, SIGN_UP_CLERK_COPY } from '@/app/clerk-copy';

/**
 * The application's single `ClerkProvider`, lifted into a Client Component for
 * one reason: `formButtonPrimary` is the only string frame `12 Sign up`
 * specifies that Clerk keys **globally**, and the route is the only thing that
 * can scope it.
 *
 * Clerk's `en-US` carries `formButtonPrimary` once, at the top level, with no
 * `signUp.start` variant, and its components read localization from the
 * provider's options rather than from React context — a second, nested
 * `ClerkProvider` around `<SignUp />` changes nothing, verified in a browser.
 * So the choice is the route or nothing: `/sign-up` gets `Create my account`
 * (D16, `21-sign-up.md`) and every other flow keeps Clerk's `Continue`, which
 * no frame contradicts because there is no sign-in frame.
 *
 * `'use client'` costs nothing here. `ClerkProvider` renders a client boundary
 * either way, `children` are still server-rendered and passed through as
 * already-rendered nodes, and the signed-in header still paints on the first
 * navigation.
 */
export function ClerkShell({ children }: { children: ReactNode }): React.ReactElement {
  const pathname = usePathname();

  return (
    /*
      Clerk inherits the palette through the shadcn slots bound in
      `globals.css`. Where its own chrome fights the layout — the auth panel
      already draws the surface, and the panel's Serif headline already says
      what Clerk's header repeats — it is corrected there too, against the same
      tokens. Never hand-write a brand hex into an appearance object: it becomes
      a second source of truth and it drifts.
    */
    <ClerkProvider
      ui={ui}
      appearance={{ theme: shadcn, variables: { borderRadius: 'var(--radius-lg)' } }}
      localization={pathname.startsWith('/sign-up') ? SIGN_UP_CLERK_COPY : CLERK_COPY}
      /*
        Clerk's SDK posts usage telemetry to `clerk-telemetry.com`, which the
        enforced CSP (#396) rightly blocks — it is Clerk's product analytics,
        not anything this app reads. Off, rather than widening `connect-src` to
        let a console error through as an outbound channel.
      */
      telemetry={false}
    >
      {children}
    </ClerkProvider>
  );
}
