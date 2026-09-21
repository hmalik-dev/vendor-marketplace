import type { EmailGateway, EmailMessage } from './email.js';

/** How many messages the mailbox keeps; a lane sends a handful per run. */
const MAILBOX_CAPACITY = 50;

export interface LaneMailbox {
  /** The newest message, optionally the newest to one recipient. */
  latest(to?: string): EmailMessage | undefined;
}

/**
 * The lane's stand-in for a mailbox (VEN-553): an E2E spec has no inbox to read
 * a step-up code from, so a local API remembers what it was asked to send.
 *
 * Wraps a gateway rather than replacing it, so delivery is unchanged. Only
 * `emailPlugin` builds it, and only when `DEPLOY_ENV` is `local`; on any
 * deployment neither the memory nor the route that reads it exists.
 */
export function withLaneMailbox(gateway: EmailGateway): {
  gateway: EmailGateway;
  mailbox: LaneMailbox;
} {
  const messages: EmailMessage[] = [];

  return {
    gateway: {
      async send(message) {
        messages.push(message);
        if (messages.length > MAILBOX_CAPACITY) {
          messages.shift();
        }
        return gateway.send(message);
      },
    },
    mailbox: {
      latest: (to) => messages.findLast((message) => to === undefined || message.to === to),
    },
  };
}
