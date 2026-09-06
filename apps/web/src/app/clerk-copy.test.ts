import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { CLERK_COPY, SIGN_UP_CLERK_COPY } from './clerk-copy';

/** Every string anywhere in the localization object, however deeply nested. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(strings);
  }
  return [];
}

/**
 * #234. Clerk interpolates `{{applicationName}}` from its own instance display
 * config, and this instance is named for the repository — so Clerk's default
 * header reads "Sign in to vendor-marketplace" and its new-device step reads
 * "to continue to vendor-marketplace".
 *
 * Neither is visible: `globals.css` hides `[data-auth-screen] .cl-header`,
 * because the panel draws its own Serif headline. **That is what makes this
 * worth a test rather than a shrug.** The user-facing name is only correct
 * because a stylesheet hides the incorrect one — remove that one rule and the
 * repository's name is read aloud, and `display: none` never protected a
 * scraper or a translation extension reading `textContent` in the first place.
 */
describe('Clerk localization overrides', () => {
  it('names the brand where Clerk would name the repository', () => {
    expect(CLERK_COPY.signIn.start.title).toBe(`Sign in to ${BRAND_NAME}`);
    expect(CLERK_COPY.signIn.emailCodeMfa.subtitle).toBe(`to continue to ${BRAND_NAME}`);
  });

  /*
   * The law in `CLAUDE.md`: anything a user reads says the brand, and it is
   * read from `BRAND_NAME` and never written as a literal — in a test too.
   * Spelling the name out in the copy would satisfy the assertion above while
   * breaking the law, so this reads the source rather than the value.
   *
   * `brand-literals.test.ts` caught this file's first draft, whose comment
   * spelled the name out while explaining why nothing should.
   */
  it('reads the name from BRAND_NAME rather than writing it out', () => {
    const source = readFileSync(join(__dirname, 'clerk-copy.ts'), 'utf8');
    const copy = source.slice(source.indexOf('export const CLERK_COPY'));
    const body = copy.slice(0, copy.indexOf('\n};'));

    expect(body).toContain('${BRAND_NAME}');
    expect(body).not.toContain(BRAND_NAME);
  });

  /*
   * Scoped keys only. `signIn.*` cannot reach `/sign-up`, and the existing
   * `signUp.start.actionText` cannot reach `/sign-in`.
   */
  it('carries no repository name anywhere in the object', () => {
    for (const value of strings(CLERK_COPY)) {
      expect(value).not.toContain('vendor-marketplace');
    }
  });

  /*
   * #194, D16. `formButtonPrimary` is a single global key shared by every flow,
   * so the frame's `Create my account` is kept out of the base object and
   * applied per route by `ClerkShell`. In here it would relabel the sign-in
   * form, where it is simply false — and there is no sign-in frame asking for
   * anything but Clerk's `Continue`.
   */
  it('keeps the submit label out of the base object, where it would reach every flow', () => {
    expect('formButtonPrimary' in CLERK_COPY).toBe(false);
  });

  it("writes the frame's submit label into the sign-up overrides only", () => {
    expect(SIGN_UP_CLERK_COPY.formButtonPrimary).toBe('Create my account');
    expect(SIGN_UP_CLERK_COPY.signIn).toBe(CLERK_COPY.signIn);
  });
});
