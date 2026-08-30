import { createHash } from 'node:crypto';
import { CAPABILITIES, WEBHOOK_FORWARDERS } from '@vendor-marketplace/shared/env';
import { type CommandOutcome, isInstalled, runCommand } from '../exec.js';
import { type Check, type CheckResult, fail, pass } from '../types.js';

export type CommandRunner = (command: string, args: readonly string[]) => Promise<CommandOutcome>;

/**
 * Whether `STRIPE_WEBHOOK_SECRET` still names the secret this machine's
 * `stripe listen` would actually forward with.
 *
 * `stripe listen --print-secret` mints — or reads back — the signing secret
 * for the current listener without starting one, and it need not agree with
 * whatever is sitting in `.env`: the CLI can mint a fresh one on a config
 * change, a re-login, or a second operator's own listener. When it drifts,
 * every webhook Stripe delivers locally fails signature verification and
 * answers 401, which reads exactly like a bug in the route under test rather
 * than a stale value one `stripe listen` copy-paste away from fixed.
 *
 * Compared as digests only, and neither value is ever placed in a result: a
 * preflight failure is exactly the kind of text that ends up pasted into a
 * ticket, a chat, or a CI log.
 */
export async function evaluateStripeSecretDrift(
  env: NodeJS.ProcessEnv,
  run: CommandRunner = runCommand,
): Promise<CheckResult | null> {
  const configured = env.STRIPE_WEBHOOK_SECRET;
  const name = 'STRIPE_WEBHOOK_SECRET matches the running stripe listen';

  // Nothing to compare against — the environment check already reports a
  // missing or placeholder STRIPE_WEBHOOK_SECRET on its own.
  if (!configured) {
    return null;
  }

  const outcome = await run('stripe', ['listen', '--print-secret']);

  // Not logged in, no network, or the CLI changed its output shape: not
  // evidence the two secrets disagree, so this stays silent rather than
  // failing the gate on a problem it did not actually observe.
  if (outcome.status !== 'ok' || !outcome.stdout.startsWith('whsec_')) {
    return null;
  }

  const digest = (value: string) => createHash('sha256').update(value).digest('hex');

  return digest(configured) === digest(outcome.stdout)
    ? pass('stripe', name, 'matches what `stripe listen` would forward with')
    : fail(
        'stripe',
        name,
        'the forwarder would mint a different secret, so every delivery answers 401',
        'Copy the printed `whsec_...` from `stripe listen --print-secret` into STRIPE_WEBHOOK_SECRET',
      );
}

export const webhookCheck: Check = {
  id: 8,
  title: 'Webhook forwarding',
  async run(context) {
    // Production receives webhooks on a public URL; nothing is forwarded.
    if (context.target === 'production') {
      return [];
    }

    const results: CheckResult[] = [];

    for (const capability of CAPABILITIES) {
      const forwarder = WEBHOOK_FORWARDERS[capability];

      if (!forwarder || !context.capabilities.has(capability)) {
        continue;
      }

      const name = `${forwarder.command} CLI forwards webhooks`;

      if (await isInstalled(forwarder.command)) {
        results.push(pass(capability, name, forwarder.forward));

        if (capability === 'stripe') {
          const drift = await evaluateStripeSecretDrift(context.env);

          if (drift) {
            results.push(drift);
          }
        }
      } else {
        // A missing forwarder shows up as a webhook that simply never arrives,
        // which is the hardest kind of local failure to attribute.
        results.push(
          fail(capability, name, `${forwarder.command} is not installed`, forwarder.install),
        );
      }
    }

    return results;
  },
};
