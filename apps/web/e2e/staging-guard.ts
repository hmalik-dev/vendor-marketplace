/**
 * The refusal `staging-messages-rls.staging.spec.ts` opens with.
 *
 * That spec signs up real accounts against a live deployment and spends a
 * Mailosaur inbox doing it, so it must never fire against a lane, CI, or a
 * developer's own machine pointed at the wrong origin by habit. Modelled on
 * `base-url.ts`'s "refuse to guess" style and
 * `packages/db/src/scripts/e2e-mail-code.ts`'s non-local refusal, which this
 * spec's mail-code calls are already bound by.
 */

const STAGING_HOST_MARKER = 'staging';

/** A refusal whose message says exactly which guard fired. */
export class StagingGuardError extends Error {}

/**
 * Throws unless `STAGING_WEB_URL` is a URL whose host names the staging
 * deployment and the spec's own shell is local. Returns the resolved origin so
 * a caller never has to re-parse the variable.
 */
export function assertStagingEnvironment(
  env: Record<string, string | undefined> = process.env,
): string {
  /*
   * `env.CI` is checked on its own, ahead of the `DEPLOY_ENV` default below:
   * `DEPLOY_ENV` defaults to `'local'` when unset, which is exactly its state
   * on this repo's CI (nothing there sets it), so `DEPLOY_ENV` alone would
   * never actually fire in CI. `STAGING_WEB_URL` being unset there is what
   * stops it today; this is a second, independent reason it would refuse.
   */
  if (env.CI) {
    throw new StagingGuardError(
      'Refusing to run the staging messages spec: CI is set. ' +
        'This spec signs up real accounts on staging and must run from a developer shell, never CI.',
    );
  }

  const deployEnv = env.DEPLOY_ENV?.trim() || 'local';

  if (deployEnv !== 'local') {
    throw new StagingGuardError(
      'Refusing to run the staging messages spec: DEPLOY_ENV is not local. ' +
        'This spec signs up real accounts on staging and must run from a local shell, never a deployment.',
    );
  }

  const raw = env.STAGING_WEB_URL?.trim();

  if (!raw) {
    throw new StagingGuardError(
      'STAGING_WEB_URL is not set. Point it at the staging web origin, for example:\n' +
        '  STAGING_WEB_URL=https://vendor-marketplace-web-git-staging-<project>.vercel.app ' +
        'DEPLOY_ENV=local pnpm --filter @vendor-marketplace/web test:e2e:staging\n' +
        'Refusing to default to anything — this spec creates real accounts.',
    );
  }

  let origin: URL;

  try {
    origin = new URL(raw);
  } catch {
    throw new StagingGuardError(`STAGING_WEB_URL ("${raw}") is not a valid URL.`);
  }

  if (!origin.hostname.toLowerCase().includes(STAGING_HOST_MARKER)) {
    throw new StagingGuardError(
      `STAGING_WEB_URL's host ("${origin.hostname}") does not name staging. ` +
        'Refusing to run this spec against a host that is not staging.',
    );
  }

  return origin.origin;
}
