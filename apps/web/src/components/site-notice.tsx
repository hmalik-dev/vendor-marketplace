import { getPlatformNotice } from '@/lib/platform-notice';
import { SiteNoticeBanner } from '@/components/site-notice-banner';

/** Reads the notice and draws the banner, or nothing when none is posted. */
export async function SiteNotice(): Promise<React.ReactElement | null> {
  const notice = await getPlatformNotice();

  return notice ? <SiteNoticeBanner message={notice.message} tone={notice.tone} /> : null;
}
