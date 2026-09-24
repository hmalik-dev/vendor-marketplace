'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  adminBanResultSchema,
  adminPackageActiveResultSchema,
  adminVendorBackupWithholdingResultSchema,
  adminVendorPayoutHoldResultSchema,
  adminVendorPublishResultSchema,
  BACKUP_WITHHOLDING_RATE_BPS,
  BACKUP_WITHHOLDING_REASON_LABELS,
  BACKUP_WITHHOLDING_REASONS,
  BRAND_NAME,
  backupWithholdingCents,
  formatPrice,
  type BackupWithholdingReason,
} from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import {
  RepublishConsequence,
  STUCK_REFUNDS_PATH,
  SuspensionConsequence,
  UnpublishConsequence,
} from '@/components/admin/vendor-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApi } from '@/lib/use-api';
import type { WireAdminVendorDetail } from '@/lib/wire-schemas';

/*
 * The controls on `/admin/vendors/[vendorId]` (VEN-380). Every one calls a
 * route that already existed and already writes its `admin_actions` row — the
 * detail promotes levers, it does not add them.
 */

type Vendor = WireAdminVendorDetail['vendor'];
type Package = WireAdminVendorDetail['packages'][number];
type PortfolioItem = WireAdminVendorDetail['portfolio'][number];

/** The one line under each action naming what it does — `11.5px` `stone-600`, per Pattern B. */
const CONSEQUENCE = 'text-helper leading-[1.5] text-stone-600';
/** The portfolio delete answers 204. */
const NO_CONTENT = z.null();
/** Destructive is outlined red, never filled (Pattern B rule 4). */
const OUTLINED_RED = 'border-error-200 text-error-500 hover:bg-error-50';

function Tier({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div data-action-tier className="flex flex-col gap-2">
      {children}
    </div>
  );
}

function Hairline(): React.ReactElement {
  return <div aria-hidden="true" className="my-1.5 h-px bg-stone-150" />;
}

/**
 * The Actions card body, least to most severe: the data-rights read, the
 * storefront, the payouts, the account.
 *
 * A retired account gets only the read, for the reason the vendor row gives
 * (#433): every lever answers 404 or 409 on it. A suspended one is offered only
 * the lift, because `PUT .../publish` refuses a banned account and the ban
 * already took the storefront down.
 */
export function VendorDetailActions({ vendor }: { vendor: Vendor }): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [stuckRefunds, setStuckRefunds] = useState(0);
  const retired = vendor.status === 'retired';
  const flagged = vendor.status === 'flagged';
  const subject = `${vendor.businessName}'s storefront`;
  /*
   * Both directions where both are meaningful (VEN-423). Unpublishing is what
   * sets the moderation hold, so a storefront its vendor already took down
   * (`paused`, `review`) still needs the Unpublish item — otherwise the hold
   * cannot be placed and the vendor can republish at will. `held` already has
   * the hold, so it offers only Publish. The Vendors table menu draws the same
   * two.
   */
  const directions = [
    ...(vendor.isPublished ? [] : [true]),
    ...(vendor.status === 'held' ? [] : [false]),
  ];

  return (
    <div className="flex flex-col gap-2 px-4 py-3.5">
      <Tier>
        <Button asChild variant="secondary" size="sm" className="w-full">
          <Link href={`/admin/users/${vendor.userId}`}>Open data rights</Link>
        </Button>
        <p className={CONSEQUENCE}>
          What {BRAND_NAME} still holds about this account, its legal acceptances, and the export.
          Opening it changes nothing.
        </p>
      </Tier>

      {retired ? (
        <p className={CONSEQUENCE}>
          This account is closed. Its bookings were unwound when it closed, so there is nothing left
          to publish, hold or suspend.
        </p>
      ) : (
        <>
          {flagged ? null : (
            <>
              <Hairline />
              <Tier>
                {directions.map((publishing) => (
                  <div key={publishing ? 'publish' : 'unpublish'} className="flex flex-col gap-2">
                    <ConfirmAction
                      trigger={
                        <Button type="button" variant="secondary" size="sm" className="w-full">
                          {publishing ? 'Publish profile' : 'Unpublish profile'}
                        </Button>
                      }
                      title={publishing ? `Publish ${subject}?` : `Unpublish ${subject}?`}
                      description={
                        publishing ? (
                          <RepublishConsequence subject="Their storefront" />
                        ) : (
                          <UnpublishConsequence subject="Their storefront" />
                        )
                      }
                      confirmLabel={publishing ? 'Publish profile' : 'Unpublish profile'}
                      onConfirm={async () => {
                        await call(`/admin/vendors/${vendor.id}/publish`, {
                          method: 'PUT',
                          body: { isPublished: publishing },
                          schema: adminVendorPublishResultSchema,
                        });
                        toast.success(
                          publishing
                            ? `${vendor.businessName}'s profile is live.`
                            : `${vendor.businessName}'s profile is hidden.`,
                        );
                        router.refresh();
                      }}
                    />
                    <p className={CONSEQUENCE}>
                      {publishing
                        ? 'Puts it back on search once the profile is complete. Confirms first.'
                        : 'Removes it from search and browse. Existing bookings stand; the vendor keeps their dashboard.'}
                    </p>
                  </div>
                ))}
              </Tier>
            </>
          )}

          <Hairline />
          <Tier>
            <ConfirmAction
              trigger={
                <Button type="button" variant="secondary" size="sm" className="w-full">
                  {vendor.payoutHold ? 'Release payout hold' : 'Hold payouts'}
                </Button>
              }
              title={
                vendor.payoutHold
                  ? `Release ${vendor.businessName}'s payouts?`
                  : `Hold ${vendor.businessName}'s payouts?`
              }
              description={
                vendor.payoutHold
                  ? 'Their due payouts release on the next sweep. Nothing else about the account changes.'
                  : 'The sweep skips their payouts until the hold is released. Payouts stay due, bookings stand and no customer is refunded.'
              }
              confirmLabel={vendor.payoutHold ? 'Release hold' : 'Hold payouts'}
              onConfirm={async () => {
                await call(`/admin/vendors/${vendor.id}/payout-hold`, {
                  method: 'PUT',
                  body: { payoutHold: !vendor.payoutHold },
                  schema: adminVendorPayoutHoldResultSchema,
                });
                router.refresh();
              }}
            />
            <p className={CONSEQUENCE}>
              {vendor.payoutHold
                ? 'Payouts are held. Releasing lets the next sweep pay what is due.'
                : 'Stops automatic payouts without touching bookings or money already paid.'}
            </p>
            <BackupWithholdingControl vendor={vendor} />
          </Tier>

          <Hairline />
          <Tier>
            {stuckRefunds > 0 ? (
              <p role="alert" className="text-sm text-error-500">
                The account was suspended, but {stuckRefunds}{' '}
                {stuckRefunds === 1 ? 'refund' : 'refunds'} could not be issued.{' '}
                <Link href={STUCK_REFUNDS_PATH} className="font-semibold underline">
                  See the bookings
                </Link>
              </p>
            ) : null}
            <ConfirmAction
              destructive={!flagged}
              trigger={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={flagged ? 'w-full' : `w-full ${OUTLINED_RED}`}
                >
                  {flagged ? 'Lift suspension' : 'Suspend vendor'}
                </Button>
              }
              title={
                flagged
                  ? `Lift the suspension on ${vendor.businessName}?`
                  : `Suspend ${vendor.businessName}?`
              }
              description={
                flagged ? (
                  'They can sign in again straight away. Their storefront stays unpublished until they publish it themselves, and the bookings cancelled by the suspension are not restored.'
                ) : (
                  <SuspensionConsequence subject="Their storefront" />
                )
              }
              confirmLabel={flagged ? 'Lift suspension' : 'Suspend vendor'}
              onConfirm={async () => {
                const result = await call(
                  `/admin/users/${vendor.userId}/${flagged ? 'unban' : 'ban'}`,
                  { method: 'PUT', schema: adminBanResultSchema },
                );
                setStuckRefunds(result.refundsFailed);
                router.refresh();
              }}
            />
            <p className={CONSEQUENCE}>
              {flagged
                ? 'Lets them sign in again. Cancelled bookings are not restored.'
                : 'Declines every open request and cancels every future confirmed booking, refunded in full from the platform balance, with no payout to the vendor. Confirms first.'}
            </p>
          </Tier>
        </>
      )}
    </div>
  );
}

/** The illustration in the consequence line: a round payout, so the split reads at a glance. */
const EXAMPLE_PAYOUT_CENTS = 100_000;
const WITHHOLDING_PERCENT = BACKUP_WITHHOLDING_RATE_BPS / 100;

/**
 * Switches backup withholding on for a vendor, or clears it, through
 * `PUT /admin/vendors/:vendorId/backup-withholding` (VEN-723, D49).
 *
 * The consequence is stated in money before the press. Switching on asks for the
 * reason and the notice date; clearing asks for the date a corrected TIN or a
 * certified W-9 arrived, and holds the button back until it is entered. Like
 * the other irreversible levers it asks for the emailed code inside the dialog.
 */
function BackupWithholdingControl({ vendor }: { vendor: Vendor }): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const [reason, setReason] = useState<BackupWithholdingReason | null>(null);
  const [date, setDate] = useState('');
  const on = vendor.backupWithholding !== null;
  const withheld = backupWithholdingCents(EXAMPLE_PAYOUT_CENTS);
  const sent = EXAMPLE_PAYOUT_CENTS - withheld;

  return (
    <>
      <ConfirmAction
        trigger={
          <Button type="button" variant="secondary" size="sm" className="w-full">
            {on ? 'Clear backup withholding' : 'Switch on backup withholding'}
          </Button>
        }
        title={
          on
            ? `Clear backup withholding for ${vendor.businessName}?`
            : `Switch on backup withholding for ${vendor.businessName}?`
        }
        description={
          on ? (
            <div className="flex flex-col gap-3">
              <p>
                Their payouts go back to the full share from the next release. What was already
                withheld is not returned.
              </p>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-900">
                Date a corrected TIN or certified W-9 was received
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p>
                From the next release, {WITHHOLDING_PERCENT}% of each of their payouts is kept for
                the IRS: on a {formatPrice(EXAMPLE_PAYOUT_CENTS)} payout, {formatPrice(withheld)} is
                withheld and {formatPrice(sent)} is sent.
              </p>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm font-medium text-stone-900">Reason</legend>
                {BACKUP_WITHHOLDING_REASONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-stone-900">
                    <input
                      type="radio"
                      name="backup-withholding-reason"
                      value={option}
                      checked={reason === option}
                      onChange={() => setReason(option)}
                    />
                    {BACKUP_WITHHOLDING_REASON_LABELS[option]}
                  </label>
                ))}
              </fieldset>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-stone-900">
                Notice date
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            </div>
          )
        }
        confirmLabel={on ? 'Clear withholding' : 'Switch on'}
        confirmDisabled={date === '' || (!on && reason === null)}
        onConfirm={async () => {
          await call(`/admin/vendors/${vendor.id}/backup-withholding`, {
            method: 'PUT',
            body: on
              ? { withholding: false, receivedDate: date }
              : { withholding: true, reason, noticeDate: date },
            schema: adminVendorBackupWithholdingResultSchema,
          });
          setReason(null);
          setDate('');
          router.refresh();
        }}
      />
      <p className={CONSEQUENCE}>
        {on
          ? `Kept for the IRS: ${WITHHOLDING_PERCENT}% of each payout. Clearing needs the date the corrected TIN or W-9 arrived.`
          : `Keeps ${WITHHOLDING_PERCENT}% of each payout for the IRS once it is switched on, from an IRS notice or a missing TIN.`}
      </p>
    </>
  );
}

/**
 * Switches one package off the storefront, or back on, through
 * `PUT /admin/packages/:packageId/active`. Says so when the last bookable
 * package took the storefront with it, because that is a second, larger thing
 * the admin did.
 */
export function PackageActiveControl({
  pkg,
  businessName,
}: {
  pkg: Package;
  businessName: string;
}): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const activating = !pkg.isActive;

  return (
    <ConfirmAction
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`${activating ? 'Activate' : 'Deactivate'} ${pkg.name}`}
        >
          {activating ? 'Activate' : 'Deactivate'}
        </Button>
      }
      title={activating ? `Activate ${pkg.name}?` : `Deactivate ${pkg.name}?`}
      description={
        activating
          ? `It goes back on ${businessName}'s storefront and can be requested again.`
          : `It comes off ${businessName}'s storefront and out of the From price. Requests already sent for it stand. If it is their last bookable package, the storefront is unpublished too.`
      }
      confirmLabel={activating ? 'Activate package' : 'Deactivate package'}
      onConfirm={async () => {
        const result = await call(`/admin/packages/${pkg.id}/active`, {
          method: 'PUT',
          body: { isActive: activating },
          schema: adminPackageActiveResultSchema,
        });
        toast.success(
          result.vendorUnpublished
            ? `${pkg.name} is deactivated, and ${businessName}'s profile is hidden because it has no bookable package left.`
            : `${pkg.name} is ${activating ? 'active' : 'deactivated'}.`,
        );
        router.refresh();
      }}
    />
  );
}

/** Removes one portfolio photo, and the stored objects behind it, permanently. */
export function PortfolioRemoveControl({
  item,
  position,
}: {
  item: PortfolioItem;
  /** 1-based, so a photo without a caption still has a name. */
  position: number;
}): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const name = item.caption ?? `photo ${position}`;

  return (
    <ConfirmAction
      destructive
      trigger={
        <button
          type="button"
          aria-label={`Remove ${name}`}
          className="absolute right-1.5 bottom-1.5 rounded-[5px] bg-stone-0 px-1.5 py-px text-xs text-error-500 hover:bg-error-50"
        >
          Remove
        </button>
      }
      title={`Remove ${name}?`}
      description="It comes off the storefront and the image is deleted from storage. This cannot be undone; the vendor would have to upload it again."
      confirmLabel="Remove photo"
      onConfirm={async () => {
        await call(`/admin/portfolio-items/${item.id}`, { method: 'DELETE', schema: NO_CONTENT });
        router.refresh();
      }}
    />
  );
}
