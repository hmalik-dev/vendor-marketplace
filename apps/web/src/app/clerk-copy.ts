import { BRAND_NAME } from '@vendor-marketplace/shared';

/**
 * The strings frame `12 Sign up` writes, where Clerk's defaults say something
 * else. Scoped keys only: `signUp.start.*` cannot leak onto `/sign-in`.
 *
 * The submit button is absent **from this object** rather than unset: it is a
 * single global key shared by every flow, so it is scoped to the sign-up route
 * by `SIGN_UP_CLERK_COPY` below. `21-sign-up.md` records no deviation
 * permitting Clerk's default there — it has specified `Create my account` since
 * it was written, and D16 confirmed it.
 */
export const CLERK_COPY = {
  formFieldLabel__emailAddress: 'Email',
  /*
   * Clerk interpolates `{{applicationName}}` from the instance's own display
   * config, and this instance is named for the repository — so its default
   * header renders "Sign in to vendor-marketplace" and its new-device step
   * renders "to continue to vendor-marketplace". Neither is visible today:
   * `[data-auth-screen] .cl-header` is `display: none` in `globals.css`,
   * because the panel's own Serif headline says what Clerk's header repeats.
   *
   * **Invisible is not the same as correct.** The wrong name is one stylesheet
   * change from being read aloud, and `display: none` does nothing for a
   * scraper or a translation extension reading `textContent`. These say the
   * brand regardless of whether anything ever shows them.
   *
   * This does not reach the source. The complete fix is renaming the Clerk
   * application itself, which is dashboard configuration rather than code and
   * is recorded on #313 as needing a human — every other key that interpolates
   * the name still carries the repository's.
   */
  signIn: {
    start: {
      title: `Sign in to ${BRAND_NAME}`,
    },
    emailCodeMfa: {
      subtitle: `to continue to ${BRAND_NAME}`,
    },
  },
  signUp: {
    start: {
      actionText: 'Already with us?',
    },
  },
};

/**
 * The one string Clerk keys globally that frame `12 Sign up` nonetheless
 * specifies: the primary action reads `Create my account`, not Clerk's default
 * `Continue` (D16, `21-sign-up.md`).
 *
 * `formButtonPrimary` has no `signUp.start` variant — it appears once, at the
 * top level of Clerk's own `en-US`, and `<SignUp />` takes no `localization`
 * prop — so putting it in `CLERK_COPY` would relabel the sign-in form too,
 * where "Create my account" is simply false. It is scoped instead by nesting a
 * second `ClerkProvider` around `<SignUp />`, which overrides the localization
 * context for that subtree and nothing else. There is no sign-in frame, so
 * Clerk's `Continue` there is uncontradicted and stays.
 */
export const SIGN_UP_CLERK_COPY = {
  ...CLERK_COPY,
  formButtonPrimary: 'Create my account',
};
