/**
 * Which release a process is, as one identifier every surface agrees on.
 *
 * The deploy workflow sets `SENTRY_RELEASE` to the commit it is shipping, and
 * that one value has to come back out of three places: the error an SDK reports,
 * the commit `/ready` names, and the release the source maps were uploaded
 * under. Three readers of three variables would let them disagree, and an error
 * that resolves to the wrong commit is worse than one that resolves to none —
 * so they all read this.
 *
 * The platforms' own commit variables follow as a fallback, so a deployment
 * the workflow did not start (a manual redeploy, a preview) still names its
 * commit rather than nothing. Like the markers in `deployment.ts`, none of these
 * is a registry row: the pipeline and the platform set them, not an operator.
 */
export const RELEASE_ENV_KEYS = [
  'SENTRY_RELEASE',
  'RAILWAY_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_SHA',
  'RENDER_GIT_COMMIT',
] as const;

/** The release this process belongs to, or `null` off a deployment. */
export function releaseIdentifier(
  source: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  for (const key of RELEASE_ENV_KEYS) {
    const value = source[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}
