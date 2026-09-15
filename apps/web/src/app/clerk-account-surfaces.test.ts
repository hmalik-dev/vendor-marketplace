import { describe, expect, it } from 'vitest';
import { sourceFiles, TS_AND_TSX, withoutComments } from '@/testing/source-scan';

/*
 * **Users never access Clerk; the owner does** — ruled by the account holder
 * 2026-09-14, VEN-403.
 *
 * Clerk's account surfaces let a signed-in person change their email address
 * or delete their account with no request through our API. A deletion there is
 * reactive, so D39's refusal to close an account holding a future confirmed
 * booking cannot answer it; an email change there is the only way to cause the
 * mirror race VEN-386 repairs. Every account change goes through the app, or
 * through `/support` and the owner.
 *
 * Sign-in and sign-up keep Clerk's embedded forms. That is authentication, not
 * account management, and none of the names below is involved in it.
 *
 * A source guard because the failure is one import: `UserButton` was in the
 * header for months, and nothing rendered in jsdom would notice it coming back.
 * Comments are blanked first, so prose explaining this rule is not an instance
 * of it.
 */
/*
 * No leading `\b`, on purpose: Clerk's imperative routes to the same screens
 * embed the name — `openUserProfile`, `redirectToUserProfile`,
 * `buildUserProfileUrl`, `openOrganizationProfile` — and a leading boundary
 * let every one of them through. The trailing boundary (or `Url`) is what keeps
 * a product name that merely starts with one, like `UserProfileSummary`, out.
 */
const FORBIDDEN = /(?:UserButton|UserProfile|OrganizationProfile)(?:Url)?\b/g;

function violationsIn(code: string): string[] {
  return [...code.matchAll(FORBIDDEN)].map((match) => match[0]);
}

describe('no Clerk account-management surface is reachable from the app (VEN-403)', () => {
  it('reads the tree it scans, so a clean answer is not a vacuous one', async () => {
    const files = await sourceFiles(undefined, TS_AND_TSX);

    expect(files.length).toBeGreaterThan(150);
    // The header is the file the control lived in, and it must be in reach.
    expect(files.map((file) => file.name)).toContain('components/site-header.tsx');
  });

  /*
   * The matcher is pinned against the exact line that used to ship, and against
   * the prose that describes it — so the guard can fail, and cannot fail on a
   * comment.
   */
  it('matches the import that used to ship, and not a comment about it', () => {
    expect(violationsIn("import { Show, UserButton } from '@clerk/nextjs';")).toEqual([
      'UserButton',
    ]);
    expect(violationsIn('const { openUserProfile } = useClerk();')).toEqual(['UserProfile']);
    expect(violationsIn('clerk.redirectToUserProfile();')).toEqual(['UserProfile']);
    expect(violationsIn('href={clerk.buildUserProfileUrl()}')).toEqual(['UserProfileUrl']);
    expect(violationsIn('openOrganizationProfile()')).toEqual(['OrganizationProfile']);
    expect(violationsIn(withoutComments('// `<UserButton />` opened Clerk’s profile'))).toEqual([]);
    // A word boundary, so a product component that merely starts with the name
    // is not a Clerk surface.
    expect(violationsIn('<UserProfileSummary />')).toEqual([]);
  });

  it('finds none of them in any source file under apps/web/src', async () => {
    const files = await sourceFiles(undefined, TS_AND_TSX);

    const found = files.flatMap(({ name, code }) =>
      violationsIn(code).map((identifier) => `${name}: ${identifier}`),
    );

    expect(found).toEqual([]);
  });
});
