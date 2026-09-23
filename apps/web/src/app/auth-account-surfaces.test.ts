import { describe, expect, it } from 'vitest';
import { sourceFiles, TS_AND_TSX, withoutComments } from '@/testing/source-scan';

/*
 * **Users never reach a provider-hosted account panel; the owner does** —
 * ruled by the account holder 2026-09-14, VEN-403, and unchanged by the move
 * from the auth provider to Neon Auth (VEN-447).
 *
 * A hosted account panel lets a signed-in person change their email address or
 * delete their account with no request through our API. A deletion there is
 * reactive, so D39's refusal to close an account holding a future confirmed
 * booking cannot answer it; an email change there is the only way to cause the
 * mirror race VEN-386 repairs. Every account change goes through the app, or
 * through `/support` and the owner.
 *
 * Neon Auth's React UI kit ships those panels (`AccountView`, `UserButton`,
 * `SettingsCards`), and Better Auth's account endpoints answer any signed-in
 * caller. Both are one import or one `fetch` away, and nothing rendered in
 * jsdom would notice either arriving, so this is a source guard. Comments are
 * blanked first, so prose explaining the rule is not an instance of it.
 */
const FORBIDDEN_SURFACES =
  /\b(?:AccountView|AccountSettings|SettingsCards|UserButton|UserProfile|OrganizationProfile|NeonAuthUIProvider|AuthView|SignedIn|SignedOut)\b/g;
const FORBIDDEN_IMPORTS = /@neondatabase\/auth\/react|@cler[k]\//g;
/*
 * An endpoint ends where its path segment does, so a module named after one
 * (`./change-password-form`) is not a call to it.
 */
const FORBIDDEN_ENDPOINTS =
  /\/(?:change-email|change-password|delete-user|update-user|link-social|unlink-account|set-password)(?![\w-])/g;

/*
 * The one account mutation the app makes itself (VEN-677): a password change,
 * from this file only, through the proxy's `forwardChangePassword`, which
 * forces every other session to end and budgets it per account. Anywhere else
 * it is still a finding.
 */
const SANCTIONED: Readonly<Record<string, readonly string[]>> = {
  'lib/auth/auth-requests.ts': ['/change-password'],
};

function violationsIn(code: string, file = ''): string[] {
  const allowed = SANCTIONED[file] ?? [];

  return [FORBIDDEN_SURFACES, FORBIDDEN_IMPORTS, FORBIDDEN_ENDPOINTS]
    .flatMap((pattern) => [...code.matchAll(pattern)].map((match) => match[0]))
    .filter((identifier) => !allowed.includes(identifier));
}

describe('no provider-hosted account surface is reachable from the app (VEN-403, VEN-447)', () => {
  it('reads the tree it scans, so a clean answer is not a vacuous one', async () => {
    const files = await sourceFiles(undefined, TS_AND_TSX);

    expect(files.length).toBeGreaterThan(150);
    // The header is the file the control lived in, and it must be in reach.
    expect(files.map((file) => file.name)).toContain('components/site-header.tsx');
    expect(files.map((file) => file.name)).toContain('lib/auth/auth-requests.ts');
  });

  /*
   * The matchers are pinned against the lines that would let a panel back in,
   * and against the prose that describes them — so the guard can fail, and
   * cannot fail on a comment.
   */
  it('matches each way a panel or an account mutation could arrive, and not a comment', () => {
    expect(violationsIn("import { AccountView } from '@neondatabase/auth/react';")).toEqual([
      'AccountView',
      '@neondatabase/auth/react',
    ]);
    expect(violationsIn('<UserButton />')).toEqual(['UserButton']);
    const legacy = `@${'cl'}${'erk'}/`;
    expect(violationsIn(`import { Show } from '${legacy}nextjs';`)).toEqual([legacy]);
    expect(violationsIn("fetch('/api/auth/delete-user', { method: 'POST' })")).toEqual([
      '/delete-user',
    ]);
    expect(violationsIn("post('/change-email', body)")).toEqual(['/change-email']);
    expect(violationsIn(withoutComments('// `<AccountView />` opened the profile'))).toEqual([]);
    // Word boundaries, so an app component that merely starts with a name is not a panel.
    expect(violationsIn('<AccountViewSummary />')).toEqual([]);
    expect(violationsIn("import { X } from '@/components/account/change-password-form';")).toEqual(
      [],
    );
  });

  it('allows the password change from the one sanctioned file, and nowhere else (VEN-677)', () => {
    const call = "post('/change-password', input)";

    expect(violationsIn(call, 'lib/auth/auth-requests.ts')).toEqual([]);
    expect(violationsIn(call, 'components/account/change-password-form.tsx')).toEqual([
      '/change-password',
    ]);
    expect(violationsIn("post('/change-email', body)", 'lib/auth/auth-requests.ts')).toEqual([
      '/change-email',
    ]);
  });

  it('finds none of them in any source file under apps/web/src', async () => {
    const files = await sourceFiles(undefined, TS_AND_TSX);

    const found = files.flatMap(({ name, code }) =>
      violationsIn(code, name).map((identifier) => `${name}: ${identifier}`),
    );

    expect(found).toEqual([]);
  });
});
