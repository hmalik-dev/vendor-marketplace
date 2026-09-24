import { publicPlatformNoticeSchema, type PublicPlatformNotice } from '@vendor-marketplace/shared';
import { apiRequest } from './api-client';

/**
 * The site-wide notice, for the root layout.
 *
 * Deliberately **not** given a `revalidate`: that cache is stale-while-revalidate,
 * so after a quiet spell the first visitor would still be served a notice the
 * admin had already cleared. The API answers from its own ten-second read of the
 * row, so an uncached read here keeps "within a minute" true after any gap.
 *
 * Fails soft to `null`: this read sits on every page, and a notice that cannot
 * be fetched must never be the reason the page around it does not render.
 */
export async function getPlatformNotice(): Promise<PublicPlatformNotice> {
  try {
    return await apiRequest('/platform/notice', { schema: publicPlatformNoticeSchema });
  } catch {
    return null;
  }
}
