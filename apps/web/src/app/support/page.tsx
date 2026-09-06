import {
  pageTitle,
  supportErrorContextSchema,
  type SupportErrorContext,
} from '@vendor-marketplace/shared';
import type { Metadata } from 'next';
import { SupportScreen } from '@/components/support/support-screen';
import { readIdentityForSupport } from '@/lib/current-user';
import {
  SUPPORT_ERROR_AT_PARAM,
  SUPPORT_ERROR_DIGEST_PARAM,
  SUPPORT_ERROR_ROUTE_PARAM,
} from '@/lib/support-link';

export const metadata: Metadata = { title: pageTitle('Contact support') };

/**
 * Frame `29 Contact support` — the destination every `Contact support`
 * affordance in the product leads to.
 *
 * **Public, and deliberately so:** the visitor most likely to need it is the
 * one who cannot sign in. Identity is read anyway, because it is the whole
 * difference between the screen's first two states, and it is read through
 * `readIdentityForSupport` — the one read in the product that redirects
 * nobody. An unreadable record, a suspended account and an unreachable API all
 * cost the reply-to row rather than the page, which matters most here: this is
 * where a visitor comes to report that the rest of it is broken.
 */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const [user, params] = await Promise.all([readIdentityForSupport(), searchParams]);

  /*
   * Parsed before anything renders it — `web-route-boundaries.md`. All three
   * values arrive in a URL anyone can paste into Slack, and the block is shown
   * only when the whole object parses: a half-valid reference reaches the
   * support inbox looking like a server-log entry that does not exist, and a
   * route that failed its shape has no business being quoted back in an email.
   * A failure drops it and the screen renders without it, exactly as a visitor
   * arriving from the footer sees it.
   */
  const parsed = supportErrorContextSchema.safeParse({
    digest: params[SUPPORT_ERROR_DIGEST_PARAM],
    route: params[SUPPORT_ERROR_ROUTE_PARAM],
    occurredAt: params[SUPPORT_ERROR_AT_PARAM],
  });

  const errorContext: SupportErrorContext | null = parsed.success ? parsed.data : null;

  return <SupportScreen accountEmail={user?.email ?? null} errorContext={errorContext} />;
}
