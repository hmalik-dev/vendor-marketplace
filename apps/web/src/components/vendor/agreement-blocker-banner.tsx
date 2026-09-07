import Link from 'next/link';
import { VENDOR_AGREEMENT_PATH } from '@vendor-marketplace/shared';
import { Banner } from '@/components/ui/banner';
import { getAgreementStatus } from '@/lib/vendor-data';

/**
 * The dashboard blocker for a vendor whose accepted agreement is behind the
 * current one — the same idiom frame `20` uses for the Stripe-not-connected
 * blocker, and for the same reason: the vendor cannot take payment until it is
 * resolved, so it belongs at the top of the pane rather than in a settings page
 * they have no reason to open.
 *
 * Gold, not red. `40-states.md` reserves red for a failure, and nothing has
 * failed here — the work is waiting on the vendor.
 *
 * Renders nothing in the two states that are not blocked: a vendor holding the
 * current version, and one with no profile yet, who is at step 2 and has not
 * reached this dashboard.
 *
 * Its own read rather than a field on the dashboard payload, because it is its
 * own question and this keeps the dashboard's contract untouched.
 */
export async function AgreementBlockerBanner(): Promise<React.ReactElement | null> {
  const status = await getAgreementStatus();

  if (!status || status.isCurrent) {
    return null;
  }

  const revised = status.accepted !== null;

  return (
    <Banner
      status="pending"
      title={revised ? 'The vendor agreement has changed' : 'Vendor agreement not accepted'}
      className="mb-4"
    >
      {revised
        ? `You accepted ${status.accepted?.version}; ${status.current} is now in force. You can't take payment until you accept it. `
        : "You can't take payment until you accept the agreement you are paid under. "}
      <Link href={VENDOR_AGREEMENT_PATH} className="font-semibold text-clay-500 hover:underline">
        {revised ? 'Read what changed' : 'Read and accept'} &rarr;
      </Link>
    </Banner>
  );
}
