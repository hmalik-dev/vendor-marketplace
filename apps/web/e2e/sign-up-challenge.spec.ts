import { expect, test } from './fixtures.js';

/**
 * #464 — what a person sees when the bot challenge cannot complete.
 *
 * **The challenge host is actually blocked here, and it is never mocked.** A
 * test that makes clerk-js reject has already done the thing the product fails
 * to do: the defect is that a real network condition produces *no response at
 * all*, so the reproduction has to be at the network.
 *
 * The two ways a host gets blocked are not the same failure, and only one of
 * them is the dead end this ticket is about:
 *
 * - **Dropped** — the request is accepted and never answered, which is what a
 *   filtering corporate or school network and several privacy extensions do.
 *   clerk-js waits on a token for ever, never sends `POST /v1/client/sign_ups`,
 *   and leaves every field and the submit button disabled. That is #464.
 * - **Refused** — the request is answered with a reset. clerk-js gives up,
 *   attempts the create, Clerk answers 400 and reports it in the card with the
 *   fields still live. Survivable already, and the second test pins that it
 *   stays that way — the bounded wait must not add a second error on top of
 *   Clerk's own.
 *
 * This is the only sign-up journey in the committed suite, and it is safe
 * against the shared Clerk development instance because neither case reaches a
 * verified account: the drop never sends the create at all, and the refusal is
 * rejected. The happy path stays out for the reason `auth.spec.ts` records, and
 * is driven by hand instead.
 */

const CHALLENGE_HOST = '**://challenges.cloudflare.com/**';

/**
 * Longer than the product's own bounded wait, so a failure here means the bound
 * did not hold rather than that the assertion was impatient.
 */
const AFTER_THE_BOUND_MS = 40_000;

const EMAIL_FIELD = 'input[name="emailAddress"]';

/**
 * The passphrase typed into Clerk's second field. Not a credential: no account
 * is ever created in either test, because in one the create request is never
 * sent and in the other Clerk rejects it.
 */
const TYPED_PASSPHRASE = 'Turnstile-Blocked-464!';

const passphraseField = 'input[name="password"]';

test.describe('sign-up when the bot challenge is dropped', () => {
  test.beforeEach(async ({ page }) => {
    /* Held open and never resolved — the request is neither answered nor
       refused, which is precisely the condition clerk-js has no bound on. */
    await page.route(CHALLENGE_HOST, () => {});
  });

  test('states the failure inside a bounded wait, and gives the form back', async ({ page }) => {
    await page.goto('/sign-up?role=customer');

    const email = page.locator(EMAIL_FIELD);
    await expect(email).toBeVisible();

    /* An address that cannot collide with what an earlier run left behind.
       Nothing is created either way — the create is what never leaves. */
    await email.fill(`orla-464-${Date.now()}@example.com`);
    await page.locator(passphraseField).fill(TYPED_PASSPHRASE);

    await page.getByRole('button', { name: 'Create my account' }).click();

    // The dead end, pinned first: this is the state the wait has to end.
    await expect(email).toBeDisabled();

    /*
     * Acceptance 1. Asserted on the sentence a person reads rather than on a
     * test id, because the requirement is that the failure became *legible* —
     * an invisible node carrying the right attribute would satisfy a structural
     * check and none of the ticket.
     */
    await expect(page.getByText(/couldn't finish the security check/i)).toBeVisible({
      timeout: AFTER_THE_BOUND_MS,
    });
    await expect(page.getByText(/challenges\.cloudflare\.com/)).toBeVisible();

    // Acceptance 2: the retry is offered explicitly, and it restores the form.
    const retry = page.getByRole('button', { name: 'Try again' });
    await expect(retry).toBeVisible();
    await retry.click();

    const emailAgain = page.locator(EMAIL_FIELD);
    await expect(emailAgain).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Create my account' })).toBeEnabled();
    await expect(page.getByText(/couldn't finish the security check/i)).toHaveCount(0);

    // Usable, not merely enabled.
    await emailAgain.fill('orla-464-retyped@example.com');
    await expect(emailAgain).toHaveValue('orla-464-retyped@example.com');
  });
});

/**
 * The third condition, and the one that keeps the message honest.
 *
 * With the host reachable, an automated browser gets the challenge script,
 * gets no token, and sits with the card disabled — measured 2026-09-08: two
 * completed `challenges.cloudflare.com` resources, no create, fields disabled.
 * Every signal except one reads exactly like the dead end.
 *
 * The banner must not appear, because it would name a network that is working.
 * This is also the only browser test that can fail if the host clause is
 * dropped: with the host blocked, that clause is false either way.
 */
test.describe('sign-up when the bot challenge host is reachable', () => {
  test('says nothing about the network when the network is fine', async ({ page }) => {
    await page.goto('/sign-up?role=customer');

    const email = page.locator(EMAIL_FIELD);
    await expect(email).toBeVisible();
    await email.fill(`orla-464-reachable-${Date.now()}@example.com`);
    await page.locator(passphraseField).fill(TYPED_PASSPHRASE);

    await page.getByRole('button', { name: 'Create my account' }).click();
    await page.waitForTimeout(AFTER_THE_BOUND_MS / 2);

    await expect(page.getByText(/couldn't finish the security check/i)).toHaveCount(0);
  });
});

test.describe('sign-up when the bot challenge is refused', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(CHALLENGE_HOST, (route) => route.abort());
  });

  test('leaves Clerk to report it, and adds no second error', async ({ page }) => {
    await page.goto('/sign-up?role=customer');

    const email = page.locator(EMAIL_FIELD);
    await expect(email).toBeVisible();
    await email.fill(`orla-464-refused-${Date.now()}@example.com`);
    await page.locator(passphraseField).fill(TYPED_PASSPHRASE);

    await page.getByRole('button', { name: 'Create my account' }).click();

    /*
     * Clerk answers this one itself and leaves the form live. Waiting past the
     * product's own bound is the point: if the stall watch fired on a failure
     * that was already reported, the person would read two different errors
     * about one press.
     */
    await page.waitForTimeout(AFTER_THE_BOUND_MS / 2);

    await expect(email).toBeEnabled();
    await expect(page.getByText(/couldn't finish the security check/i)).toHaveCount(0);
  });
});
