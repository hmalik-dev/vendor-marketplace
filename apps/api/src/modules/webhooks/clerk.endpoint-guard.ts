/**
 * Rejects a Clerk webhook endpoint that is a local-development relay.
 *
 * `clerk webhooks listen` registers a Svix endpoint of the form
 * `https://webhooks.clerk.com/in/c_<token>`, which forwards to whoever is
 * running the CLI. Pointed at the production Clerk app, it is not an endpoint
 * at all: events go to a developer's laptop, or nowhere, and the API sees
 * nothing. Because a webhook that never arrives raises no error, this survived
 * the entire life of the deployment undetected.
 *
 * The check is deliberately about the *shape* of the value rather than a
 * reachability probe: a relay is wrong even when it is up, and the deployment
 * must not depend on Clerk's API answering in order to start.
 */

export type EndpointVerdict = { ok: true } | { ok: false; reason: string };

/** The CLI relay host. Anything under it is a forwarding token, never an API. */
const RELAY_HOST = 'webhooks.clerk.com';

/**
 * Checks a configured Clerk webhook endpoint against the origin it should have.
 *
 * `expectedOrigin` is the deployment's own public origin. It is compared rather
 * than merely required to be non-relay, because the failure this guards against
 * is an endpoint pointing at *something else that works* — a stale Railway
 * domain, a preview deployment, a colleague's tunnel — which is every bit as
 * silent as the relay was.
 */
export function checkWebhookEndpoint(
  endpoint: string | undefined,
  expectedOrigin: string | undefined,
): EndpointVerdict {
  const value = endpoint?.trim();

  if (!value) {
    return { ok: false, reason: 'No Clerk webhook endpoint is configured.' };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: `"${value}" is not a URL.` };
  }

  if (url.hostname === RELAY_HOST) {
    return {
      ok: false,
      reason:
        `"${value}" is a \`clerk webhooks listen\` relay, not the API. ` +
        'Events sent there never reach the deployment. Point the Svix endpoint ' +
        `at <origin>/webhooks/clerk instead.`,
    };
  }

  // A relay reached over plain HTTP is still a relay, but this catches the
  // separate mistake of signing secrets travelling in the clear.
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    return { ok: false, reason: `"${value}" is not served over HTTPS.` };
  }

  if (!url.pathname.endsWith('/webhooks/clerk')) {
    return {
      ok: false,
      reason: `"${value}" does not end in /webhooks/clerk, which is the route that handles these events.`,
    };
  }

  const expected = expectedOrigin?.trim();
  if (!expected) {
    // Nothing to compare against; the shape checks above still stand.
    return { ok: true };
  }

  let expectedUrl: URL;
  try {
    expectedUrl = new URL(expected);
  } catch {
    return { ok: false, reason: `The expected origin "${expected}" is not a URL.` };
  }

  if (url.origin !== expectedUrl.origin) {
    return {
      ok: false,
      reason: `"${value}" points at ${url.origin}, but this deployment is ${expectedUrl.origin}. Its webhooks are going somewhere else.`,
    };
  }

  return { ok: true };
}

/**
 * The origin this process is actually reachable at, or `null` off a platform.
 *
 * Railway injects its public domain without a scheme. Off a platform there is
 * no deployment to compare against — and locally a relay is the *correct*
 * configuration — so the guard has nothing to say and stays silent.
 */
export function deploymentOrigin(source: NodeJS.ProcessEnv = process.env): string | null {
  const domain = source.RAILWAY_PUBLIC_DOMAIN?.trim();

  return domain ? `https://${domain}` : null;
}

/**
 * Fails the boot when this deployment's Clerk webhooks are going somewhere
 * that is not this deployment.
 *
 * Loud at startup rather than at the first missed webhook, because the whole
 * character of this failure is that there *is* no first missed webhook to
 * notice: events simply stop arriving, nothing errors, and the data quietly
 * drifts for as long as nobody looks.
 */
export function assertWebhookEndpoint(
  endpoint: string | undefined,
  source: NodeJS.ProcessEnv = process.env,
): void {
  const origin = deploymentOrigin(source);

  if (!origin) {
    return;
  }

  const verdict = checkWebhookEndpoint(endpoint, origin);

  if (!verdict.ok) {
    throw new Error(
      `Clerk webhook endpoint is misconfigured: ${verdict.reason}\n` +
        'Set it in the Clerk dashboard (Configure → Webhooks) and in CLERK_WEBHOOK_ENDPOINT.',
    );
  }
}
