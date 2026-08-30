import { BRAND_NAME } from '@vendor-marketplace/shared';

/**
 * The strings frame `12 Sign up` writes, where Clerk's defaults say something
 * else. Scoped keys only: `signUp.start.*` cannot leak onto `/sign-in`.
 *
 * The submit button is deliberately absent. Clerk's `formButtonPrimary` is a
 * single global key shared by every flow, so setting it to the frame's "Create
 * my account" would also put that label on the sign-in form, where it is simply
 * wrong. A wrong string on one screen is worse than a generic one on another —
 * see the deviation note in design/design-plan/21-sign-up.md.
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
