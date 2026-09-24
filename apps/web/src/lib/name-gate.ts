import { hasPersonalName } from '@vendor-marketplace/shared';
import { redirect } from 'next/navigation';
import { isNameGateExemptPath, nameStepPath } from './name-gate-paths';
import { requestedPath, requestedPathname } from './requested-path';

/**
 * The name gate, on the server (VEN-701): a signed-in customer with no real
 * first and last name is sent to the name step from every account-bearing page,
 * not only from `/after-sign-in`, so leaving the step (Back, a typed URL, a
 * bookmark) does not skip it. The API refuses the writes that would show the
 * name to someone else (`NAME_REQUIRED`); this is the screen the reader is owed.
 *
 * Not middleware, for `terms-gate.ts`'s reason. Public browsing (`/search`,
 * storefronts) stays open: forcing every public page through this would make
 * cached public pages dynamic (VEN-610).
 *
 * `redirect()` throws, so this either navigates or falls through.
 */
export async function redirectIfNameRequired(
  user: { role: string; firstName: string; lastName: string },
  returnTo?: string | null,
): Promise<void> {
  if (user.role !== 'customer' || hasPersonalName(user)) {
    return;
  }

  /*
   * Exempt by the page being rendered, never by `returnTo`: the name step
   * itself calls `requireRole('customer', returnTo)` carrying the destination it
   * will resume, and judging that would send it to itself. The pathname is read
   * uncapped, because a long `returnTo` makes the step's own URL longer than
   * `requestedPath()` will return.
   */
  const rendering = (await requestedPathname()) ?? returnTo?.split(/[?#]/, 1)[0] ?? null;

  if (rendering !== null && isNameGateExemptPath(rendering)) {
    return;
  }

  redirect(nameStepPath(returnTo ?? (await requestedPath())));
}
