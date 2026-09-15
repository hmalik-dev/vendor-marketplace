'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  adminBanResultSchema,
  adminPackageActiveResultSchema,
  adminVendorPayoutHoldResultSchema,
  adminVendorPublishResultSchema,
  BRAND_NAME,
} from '@vendor-marketplace/shared';
import { ConfirmAction } from '@/components/admin/confirm-action';
import {
  RepublishConsequence,
  STUCK_REFUNDS_PATH,
  SuspensionConsequence,
  UnpublishConsequence,
} from '@/components/admin/vendor-table';
import { Button } from '@/components/ui/button';
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
  const publishing = !vendor.isPublished;

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
                : "Declines every open request and cancels every future confirmed booking, refunded in full — the vendor's share reverses out of their Stripe balance. Confirms first."}
            </p>
          </Tier>
        </>
      )}
    </div>
  );
}

/**
 * Switches one package off the storefront, or back on, through
 * `PUT /admin/packages/:packageId/active`. Says so when the last bookable
 * package took the storefront with it, because that is a second, larger thing
 * the operator did.
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
