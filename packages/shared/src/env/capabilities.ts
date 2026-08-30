// This is a value import while `registry.ts` imports only the `Capability`
// *type* from this file — `verbatimModuleSyntax` erases that side, so the two
// modules do not form a runtime cycle.
import { ENV_REGISTRY, type EnvVariable } from './registry.js';

/**
 * A capability names an external service or toolchain concern that some slice
 * of the product depends on. Every environment variable belongs to exactly one
 * capability, and every ticket declares the capabilities it needs — so a ticket
 * that never touches Stripe is never blocked on Stripe credentials.
 */
export const CAPABILITIES = [
  'core',
  'auth',
  'storage',
  'stripe',
  'email',
  'sentry',
  'e2e',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Human-readable heading used when preflight and `.env.example` group by capability. */
export const CAPABILITY_LABELS: Readonly<Record<Capability, string>> = {
  core: 'App + Database',
  auth: 'Auth (Clerk)',
  storage: 'Object storage (Cloudflare R2 / MinIO)',
  stripe: 'Payments (Stripe Connect)',
  email: 'Email (Resend)',
  sentry: 'Error tracking (Sentry)',
  e2e: 'Browser verification',
};

/**
 * Capabilities whose provider sends inbound webhooks, and the CLI that forwards
 * them to a local port. Preflight check 8 refuses to start a ticket that needs
 * one of these while the CLI is missing, because the failure would otherwise
 * surface as a webhook that silently never arrives.
 */
export interface WebhookForwarder {
  /** Executable expected on `PATH`. */
  readonly command: string;
  /** Literal command that installs it. */
  readonly install: string;
  /** Literal command that starts forwarding once installed. */
  readonly forward: string;
}

export const WEBHOOK_FORWARDERS: Readonly<Partial<Record<Capability, WebhookForwarder>>> = {
  auth: {
    command: 'clerk',
    install: 'brew install clerk/tap/clerk',
    forward: 'clerk webhooks listen --forward-to http://localhost:4000/webhooks/clerk',
  },
  stripe: {
    command: 'stripe',
    install: 'brew install stripe/stripe-cli/stripe',
    /*
     * All four streams, because a v2 connected account announces itself on the
     * v1 **snapshot Connect** stream, not the thin one. Probed on 2026-08-30: a
     * full onboarding attempt emitted `capability.updated`,
     * `account.application.authorized` and `account.updated` — all v1, all
     * Connect-scoped — and no thin event at all, because thin `v2.core.*`
     * delivery needs an event destination provisioned separately.
     *
     * A lane forwarding only `--forward-to` therefore watches the hosted form
     * complete and the vendor stay unonboarded forever, with nothing in either
     * log saying why. The thin flags are kept so the integration keeps working
     * once event destinations exist.
     */
    forward:
      'stripe listen --forward-to localhost:4000/webhooks/stripe --forward-connect-to localhost:4000/webhooks/stripe --forward-thin-to localhost:4000/webhooks/stripe --forward-thin-connect-to localhost:4000/webhooks/stripe',
  },
};

/** Capabilities backed by a service in `docker-compose.yml`, keyed to that service name. */
export const COMPOSE_SERVICES: Readonly<Partial<Record<Capability, string>>> = {
  storage: 'storage',
};

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value);
}

const VARIABLES_BY_CAPABILITY: ReadonlyMap<Capability, readonly EnvVariable[]> = (() => {
  const index = new Map<Capability, EnvVariable[]>(
    CAPABILITIES.map((capability) => [capability, []]),
  );

  for (const variable of ENV_REGISTRY) {
    index.get(variable.capability)?.push(variable);
  }

  return index;
})();

/** Every `.env` variable belonging to a capability, in registry order. */
export function variablesFor(capability: Capability): readonly EnvVariable[] {
  return VARIABLES_BY_CAPABILITY.get(capability) ?? [];
}

/** Every `.env` variable belonging to any of the given capabilities, in registry order. */
export function variablesForAll(capabilities: Iterable<Capability>): readonly EnvVariable[] {
  const wanted = new Set(capabilities);
  return ENV_REGISTRY.filter((variable) => wanted.has(variable.capability));
}
