import { resendProbes } from './providers.js';
import { settle } from './run.js';
import { failed, passed, type LaunchOptions, type LaunchResult } from './types.js';

/**
 * VEN-626. Resend's own shared test sender — the only address it offers
 * without a verified domain. It delivers only to the Resend account owner, so
 * this exception is the release check's alone: `launch:check` (the real-money
 * gate) still fails it, and no other `resend.dev` address qualifies.
 */
const RESEND_SHARED_TEST_SENDER = 'onboarding@resend.dev';

/**
 * VEN-609. The deploy's proof that a release sends from a domain Resend has
 * verified: launch:check's `resend sending domain` probe, held to a release's
 * bar. An unverified sender is not a visible failure — Resend refuses each send
 * and the API only logs it, so booking email, the admin step-up code and the
 * operator pager all stop at once while the release reads green.
 *
 * `MANUAL` passes `launch:check`, where a person reads it; in the workflow
 * nobody does, so a key that cannot list domains fails like an unverified
 * domain, naming the fix.
 */
export async function releaseSenderResults(
  options: Pick<LaunchOptions, 'env' | 'get'>,
): Promise<LaunchResult[]> {
  // `EMAIL_FROM` may be a bare address or `Name <address>`.
  const address = /([^\s<>@]+@[^\s<>]+?)>?\s*$/.exec(options.env.EMAIL_FROM ?? '')?.[1];

  if (address === RESEND_SHARED_TEST_SENDER) {
    return [
      passed(
        'resend',
        'resend sending domain',
        `${RESEND_SHARED_TEST_SENDER} is Resend's shared test sender — delivers only to the Resend account owner; verify a domain (VEN-563) before real users`,
      ),
    ];
  }

  const results = (await Promise.all(resendProbes(options).map(settle))).flat();

  return results.map((result) =>
    result.status === 'MANUAL'
      ? failed(
          result.group,
          result.name,
          `${result.detail}; a release must prove it, so give this GitHub environment's RESEND_API_KEY secret domain read access (a full-access Resend key)`,
        )
      : result,
  );
}
