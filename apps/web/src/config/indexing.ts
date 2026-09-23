/**
 * Whether search engines may index this deployment: **production only**
 * (VEN-606).
 *
 * Staging answered `Allow: /` on a public branch alias, which Vercel does not
 * mark `noindex`, so a crawler that found it indexed a second marketplace. The
 * tier is `NEXT_PUBLIC_DEPLOY_ENV`, the validated `DEPLOY_ENV` that
 * `next.config.ts` inlines, so the build and every later request read one
 * value. Anything but the exact registry production value — unset included —
 * is not production: a missing tier means noindex, never index.
 */
export function searchIndexed(
  deployEnv: string | undefined = process.env.NEXT_PUBLIC_DEPLOY_ENV,
): boolean {
  return deployEnv === 'production';
}
