import { expect, test } from './fixtures.js';
import { E2E_VENDOR_SLUG } from './fixtures-data.js';

/**
 * The messaging journey, driven end to end between the two E2E accounts.
 *
 * The suite **opens its own thread** rather than expecting one in the seed.
 * `seed:e2e` gives the vendor a live booking request, but nothing guarantees the
 * E2E *customer* is the party on it — an earlier draft of this file assumed so
 * and failed against an empty list, which is a fixture assumption masquerading
 * as a product assertion. Opening the thread from the profile also exercises the
 * path a real customer takes.
 *
 * Selectors are role- and label-based. The composer's placeholder interpolates
 * the other party's name and thread rows carry a business name, both of which a
 * seed change moves; the accessible name is the stable contract.
 */
test.describe('messaging', () => {
  test('shows the customer their inbox', async ({ customerPage }) => {
    await customerPage.goto('/messages');

    await expect(customerPage.getByRole('heading', { name: 'Messages' })).toBeVisible();
  });

  test('opens a thread from the vendor profile and delivers to the vendor', async ({
    customerPage,
    vendorPage,
  }) => {
    await customerPage.goto(`/vendors/${E2E_VENDOR_SLUG}`);

    const openThread = customerPage.getByRole('button', { name: 'Send a message' });
    await expect(
      openThread,
      `no "Send a message" control on /vendors/${E2E_VENDOR_SLUG} — has seed:e2e published this vendor?`,
    ).toBeVisible();
    await openThread.click();

    // #310 routes this to the thread it just opened, by id.
    await expect(customerPage).toHaveURL(/\/messages\?conversation=/);

    const composer = customerPage.getByLabel('Write a message');
    await expect(composer).toBeVisible();

    /*
     * Unique per run. A fixed string would pass on a previous run's message
     * still sitting in the thread, so the assertion would survive the send path
     * being broken entirely — the "what state would make this fail?" test.
     */
    const sent = `E2E delivery probe ${Date.now()}`;
    await composer.fill(sent);
    await customerPage.getByRole('button', { name: /^send$/i }).click();

    await expect(customerPage.getByText(sent)).toBeVisible();

    // The other side is what proves delivery rather than a local echo.
    await vendorPage.goto('/messages');
    await expect(
      vendorPage.getByText(sent),
      'the vendor cannot see a message the customer sent — delivery, not echo, is broken',
    ).toBeVisible({ timeout: 20_000 });
  });

  /*
   * Whitespace is refused by *disabling* Send, not by rejecting the submit — so
   * that is what this asserts. An earlier draft clicked the button and waited
   * for it to become enabled, which timed out after 90s and reported the
   * correct behaviour as a failure. Test the mechanism the product actually
   * uses, or the test is about a product that does not exist.
   */
  test('disables Send for an empty or whitespace-only draft', async ({ customerPage }) => {
    await customerPage.goto(`/vendors/${E2E_VENDOR_SLUG}`);
    await customerPage.getByRole('button', { name: 'Send a message' }).click();
    await expect(customerPage).toHaveURL(/\/messages\?conversation=/);

    const composer = customerPage.getByLabel('Write a message');
    const send = customerPage.getByRole('button', { name: /^send$/i });

    await expect(send, 'Send is available with an empty draft').toBeDisabled();

    await composer.fill('   ');
    await expect(send, 'Send is available for a whitespace-only draft').toBeDisabled();

    // And it becomes available once there is something to send, which is what
    // proves the assertion above is about the draft rather than a dead button.
    await composer.fill('Hello');
    await expect(send).toBeEnabled();
  });
});
