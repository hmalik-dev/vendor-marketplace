import { loadEnv } from '@vendor-marketplace/db';
import { isDeployedRuntime } from '@vendor-marketplace/shared/env';
import { parseEnv, type ApiEnv } from './env.js';

/**
 * A check on the parsed environment that the schema cannot express because it
 * relates two values. Returns the reason to refuse, or `null` when satisfied.
 */
export interface BootGuard {
  name: string;
  check(env: ApiEnv, source: NodeJS.ProcessEnv): string | null;
}

const LIVE_KEY_PREFIX = 'sk_live_';

/**
 * The one list of boot-time guards. `bootEnv` is the only caller, and both
 * entry points (`index.ts` `main()` for the container, `server.ts` `handler`
 * for Vercel) go through it, so a guard added here cannot run in one and not
 * the other.
 */
export const BOOT_GUARDS: readonly BootGuard[] = [
  {
    // A live Stripe key beside a plain-HTTP web origin sends Connect return
    // redirects and credentialed CORS traffic over cleartext.
    name: 'live Stripe key requires https origins',
    check(env, source) {
      if (!isDeployedRuntime(source) || !env.STRIPE_SECRET_KEY.startsWith(LIVE_KEY_PREFIX)) {
        return null;
      }
      const plain = env.WEB_URL.split(',')
        .map((url) => url.trim())
        .filter((url) => url !== '' && !url.startsWith('https://'));
      return plain.length > 0
        ? `STRIPE_SECRET_KEY is live but ${plain.join(', ')} is not https`
        : null;
    },
  },
];

export function runBootGuards(
  env: ApiEnv,
  source: NodeJS.ProcessEnv = process.env,
  guards: readonly BootGuard[] = BOOT_GUARDS,
): void {
  const refusals = guards.flatMap((guard) => {
    const reason = guard.check(env, source);
    return reason === null ? [] : [`${guard.name}: ${reason}`];
  });
  if (refusals.length > 0) {
    throw new Error(`API refused to start:\n  ${refusals.join('\n  ')}`);
  }
}

/** Load, parse and guard the environment: the start of every entry point. */
export function bootEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  loadEnv();
  const env = parseEnv(source);
  runBootGuards(env, source);
  return env;
}
