import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLERK_COPY, SIGN_UP_CLERK_COPY } from '@/app/clerk-copy';
import { withoutComments } from '@/testing/source-scan';

const pathname = vi.hoisted(() => ({ value: '/' }));
const provider = vi.hoisted(() => ({
  localization: undefined as unknown,
  telemetry: undefined as unknown,
}));

vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({
    localization,
    telemetry,
    children,
  }: {
    localization: unknown;
    telemetry: unknown;
    children: React.ReactNode;
  }) => {
    provider.localization = localization;
    provider.telemetry = telemetry;
    return <>{children}</>;
  },
}));

vi.mock('@clerk/ui', () => ({ ui: {} }));
vi.mock('@clerk/ui/themes', () => ({ shadcn: {} }));

const { ClerkShell } = await import('./clerk-shell');

function renderAt(route: string): typeof provider {
  pathname.value = route;
  render(
    <ClerkShell>
      <p>app</p>
    </ClerkShell>,
  );

  return provider;
}

const localizationAt = (route: string): unknown => renderAt(route).localization;

/**
 * #194, D16. Clerk keys `formButtonPrimary` once, globally, and its components
 * read localization from the provider's options rather than from React context
 * — a second, nested `ClerkProvider` around `<SignUp />` changes nothing,
 * verified in a browser. The route is the only thing left that can scope it,
 * which is the entire reason this component exists.
 */
describe('ClerkShell', () => {
  afterEach(() => cleanup());

  it("gives the sign-up route the frame's submit label", () => {
    expect(localizationAt('/sign-up')).toBe(SIGN_UP_CLERK_COPY);
  });

  /*
   * Clerk's verification and continuation steps are path navigations under
   * `/sign-up`, so the label has to survive them rather than reverting to
   * `Continue` halfway through the flow.
   */
  it('keeps it through the sign-up flow’s deeper steps', () => {
    expect(localizationAt('/sign-up/verify-email-address')).toBe(SIGN_UP_CLERK_COPY);
  });

  /*
   * "Create my account" on the sign-in form would be simply false, and no
   * frame asks for anything there — there is no sign-in frame at all.
   */
  it.each(['/sign-in', '/', '/vendor/dashboard'])('leaves %s on Clerk’s own label', (route) => {
    expect(localizationAt(route)).toBe(CLERK_COPY);
  });

  /*
   * #396. Under the enforced Content-Security-Policy, Clerk's browser SDK
   * posted its usage telemetry to `clerk-telemetry.com`, which no directive
   * allows, and every signed-in page logged a violation. The fix is to not
   * send it: it is Clerk's product analytics, not anything this app reads, and
   * widening `connect-src` for it would trade a console error for an outbound
   * channel nobody asked for.
   */
  it('sends Clerk no telemetry, so the enforced CSP has nothing to block', () => {
    expect(renderAt('/').telemetry).toBe(false);
  });

  /*
   * The assertions above hold this component to its contract; this one holds
   * the application to using it. Everything the provider carries — the
   * telemetry switch above, the route-scoped label, the appearance — is lost
   * silently if the root layout stops rendering it, and no test that renders
   * the shell in isolation can notice.
   */
  it('is the provider the root layout actually renders', () => {
    // Vitest runs with the package root as cwd, which is where vitest.config.ts sits.
    // Comments stripped first: the layout's own prose names both components, so
    // a commented-out `<ClerkShell>` would otherwise satisfy this.
    const layout = withoutComments(readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8'));

    expect(layout).toContain('<ClerkShell>');
    expect(layout).not.toContain('<ClerkProvider');
  });
});
