import { CAPABILITIES, WEBHOOK_FORWARDERS } from '@vendorhub/shared/env';
import { isInstalled } from '../exec.js';
import { type Check, type CheckResult, fail, pass } from '../types.js';

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
