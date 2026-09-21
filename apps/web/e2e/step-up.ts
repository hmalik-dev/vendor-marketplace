import type { Locator, Page } from '@playwright/test';

import { resolveE2EApiUrl } from './base-url';
import { expect } from './fixtures';

/**
 * Drives the step-up code step of an irreversible console action (VEN-500) in a
 * lane, where no mailbox exists to read the emailed code from.
 *
 * The lane API keeps what it sent and serves it at `/__lane/mailbox/latest`;
 * that route is registered only when `DEPLOY_ENV` is `local`
 * (`apps/api/src/plugins/email.ts`), so this cannot work, and nothing exposes
 * a code, on a deployment. Call it after the confirm was pressed and the API
 * refused with `STEP_UP_REQUIRED`; it leaves the action retried.
 */
export async function completeStepUp(page: Page, dialog: Locator): Promise<void> {
  const to = process.env.E2E_ADMIN_EMAIL?.trim();
  const url = new URL('/__lane/mailbox/latest', `${resolveE2EApiUrl()}/`);
  if (to) {
    url.searchParams.set('to', to);
  }
  // A code from an earlier run must not be mistaken for the one about to be sent.
  const before = await page.request.get(url.href);
  const stale = before.ok() ? ((await before.json()) as { text: string }).text : null;

  // The grant lasts ten minutes, so an earlier closure by this operator can already
  // have let this one through: the dialog then closes and there is no code step.
  const send = dialog.getByRole('button', { name: 'Email me a code' });
  const asked = await Promise.race([
    send.waitFor({ state: 'visible' }).then(() => true),
    dialog.waitFor({ state: 'hidden' }).then(() => false),
  ]);
  if (!asked) {
    await page.reload();
    return;
  }

  await send.click();
  const field = dialog.getByLabel('Six-digit code');
  await expect(field).toBeVisible();

  let code = '';
  await expect
    .poll(async () => {
      const response = await page.request.get(url.href);
      const text = response.ok() ? ((await response.json()) as { text: string }).text : '';
      code = text !== stale ? (/confirmation code is (\d{6})\b/.exec(text)?.[1] ?? '') : '';
      return code;
    })
    .toMatch(/^\d{6}$/);

  await field.fill(code);
  await dialog.getByRole('button', { name: 'Confirm code' }).click();

  /*
   * The retried action has landed once the dialog closes, but the page behind it
   * is still the stale render: the `router.refresh()` that follows a retried
   * closure does not repaint it (observed on VEN-553; the record is closed, a
   * reload shows it). Reloading keeps the specs on what the API committed.
   */
  await expect(dialog).toBeHidden();
  await page.reload();
}
