import { AdminSurface } from '@/components/admin/admin-surface';
import { PlatformSettingsPanel } from '@/components/admin/platform-settings-panel';
import { getAdminPlatformSettings } from '@/lib/admin-data';

/**
 * The launch switches (VEN-404): pause new requests, checkout or automatic
 * payouts, cap booking value, and hold one vendor's payouts — without a deploy.
 *
 * Deliberately unframed. No frame draws this screen, so it follows the console's
 * surface (heading, count line, content pane) rather than inventing a layout.
 */
export default async function AdminSettingsPage(): Promise<React.ReactElement> {
  const settings = await getAdminPlatformSettings();
  const paused = [
    settings.bookingRequestsPaused,
    settings.checkoutPaused,
    settings.payoutReleasePaused,
  ].filter(Boolean).length;

  return (
    <AdminSurface
      heading="Settings"
      counts={[
        `${paused} of 3 switches paused`,
        `${settings.heldVendors.length} ${settings.heldVendors.length === 1 ? 'vendor' : 'vendors'} on payout hold`,
      ]}
    >
      <PlatformSettingsPanel settings={settings} />
    </AdminSurface>
  );
}
