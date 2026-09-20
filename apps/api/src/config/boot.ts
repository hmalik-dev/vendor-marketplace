import { loadEnv } from '@vendor-marketplace/db';
import {
  isDeployedBuild,
  isDeployedRuntime,
  liveKeyOutsideProduction,
} from '@vendor-marketplace/shared/env';
import { stripeKeyMode } from '../lib/stripe.js';
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
    // The webhook compares each event's `livemode` to the key's mode; a key of
    // no recognised mode would make that comparison silently skip.
    name: 'Stripe key has a recognised mode',
    check: (env) =>
      stripeKeyMode(env.STRIPE_SECRET_KEY) === null
        ? `STRIPE_SECRET_KEY starts ${JSON.stringify(/^[^_]{1,8}(?:_[^_]{1,8}_)?/.exec(env.STRIPE_SECRET_KEY)?.[0])}, not sk_live_, sk_test_, rk_live_ or rk_test_`
        : null,
  },
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
  {
    // Nothing else ties a live key to *being* production: a staging API or a
    // laptop holding one moves real money on seeded data.
    name: 'live Stripe key requires DEPLOY_ENV=production',
    check: (env) =>
      liveKeyOutsideProduction('STRIPE_SECRET_KEY', env.STRIPE_SECRET_KEY, env.DEPLOY_ENV),
  },
  {
    // The schema accepts `local`, the development default, on a deployment. On
    // a platform that announces itself that silently drops every email (no
    // sink) and tags Sentry `local`, so it refuses like an unset value does. A
    // local container run sets only NODE_ENV, announces no platform, and is exempt.
    name: 'a hosted platform cannot declare DEPLOY_ENV=local',
    check: (env, source) =>
      isDeployedBuild(source) && env.DEPLOY_ENV === 'local'
        ? 'this process runs on a hosting platform but DEPLOY_ENV is local'
        : null,
  },
  {
    // The schema cannot relate two rows; without a sink a staging API has no
    // safe place to deliver, so it refuses rather than mail real recipients.
    name: 'staging requires an email sink',
    check: (env) =>
      env.DEPLOY_ENV === 'staging' && env.EMAIL_SINK_ADDRESS === undefined
        ? 'DEPLOY_ENV is staging but EMAIL_SINK_ADDRESS is not set'
        : null,
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
