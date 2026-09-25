'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import {
  adminVendorPayoutHoldResultSchema,
  formatPrice,
  MAX_PACKAGE_PRICE_CENTS,
  MAX_NAME_LENGTH,
  PLATFORM_NOTICE_MAX_LENGTH,
  PLATFORM_NOTICE_TONES,
  type PlatformNoticeTone,
  type PlatformSwitches,
  type UpdatePlatformSettings,
} from '@vendor-marketplace/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';
import {
  wireAdminPlatformSettingsSchema,
  wireAdminVendorPageSchema,
  type WireAdminPlatformSettings,
  type WireAdminVendorRow,
} from '@/lib/wire-schemas';

/** Same form as `/admin/activity`: absolute, 24-hour, UTC and saying so. */
const WHEN = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
  timeZoneName: 'short',
});

const CENTS_PER_DOLLAR = 100;
const VENDOR_SEARCH_PAGE_SIZE = 5;
const SAVE_FAILED = 'That change did not save. Check your connection and try again.';

type PauseField = Exclude<keyof PlatformSwitches, 'maxBookingCents' | 'vendorInviteOnly'>;
type HeldVendorEntry = WireAdminPlatformSettings['heldVendors'][number];

const SWITCHES: readonly { field: PauseField; label: string; description: string }[] = [
  {
    field: 'bookingRequestsPaused',
    label: 'Pause new booking requests',
    description:
      'Customers cannot send a request. Vendors can still accept, decline and cancel the ones they have.',
  },
  {
    field: 'checkoutPaused',
    label: 'Pause checkout',
    description:
      'No new payment is started, and customers are told bookings are paused. A checkout a customer already has open can still complete.',
  },
  {
    field: 'payoutReleasePaused',
    label: 'Pause automatic payouts',
    description:
      'The sweep transfers nothing. Due payouts wait and release on the first sweep after this is off; a retry on Payments still releases one by hand.',
  },
];

export interface PlatformSettingsPanelProps {
  settings: WireAdminPlatformSettings;
}

export function PlatformSettingsPanel({
  settings,
}: PlatformSettingsPanelProps): React.ReactElement {
  const router = useRouter();
  const call = useApi();
  const fieldId = useId();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /*
   * The confirmed server state, applied from each write's own response rather
   * than from `settings` re-rendering after `router.refresh()`. CI saw that
   * refresh land the audited PUT server-side and never commit the transition
   * client-side (VEN-576): `settings` stayed stale for the whole test timeout
   * even though the switch had genuinely flipped. `router.refresh()` still
   * runs, best-effort, to pick up anything server-rendered elsewhere on the
   * page (the surface's paused/held counts) — but nothing the admin looks
   * at on this panel waits on it landing.
   */
  const [confirmed, setConfirmed] = useState(settings);
  const [capDollars, setCapDollars] = useState(
    settings.maxBookingCents === null ? '' : String(settings.maxBookingCents / CENTS_PER_DOLLAR),
  );

  const [noticeDraft, setNoticeDraft] = useState(settings.noticeMessage ?? '');
  const [noticeTone, setNoticeTone] = useState<PlatformNoticeTone>(settings.noticeTone);

  useEffect(() => {
    setConfirmed(settings);
  }, [settings]);

  async function run(action: () => Promise<unknown>): Promise<void> {
    setSaving(true);
    setFailure(null);

    try {
      await action();
      router.refresh();
    } catch (error) {
      setFailure(userFacingError(error, SAVE_FAILED));
    } finally {
      setSaving(false);
    }
  }

  function save(patch: UpdatePlatformSettings): Promise<void> {
    return run(async () => {
      setConfirmed(
        await call('/admin/settings', {
          method: 'PUT',
          body: patch,
          schema: wireAdminPlatformSettingsSchema,
        }),
      );
    });
  }

  function applyHold(vendor: HeldVendorEntry, payoutHold: boolean): void {
    setConfirmed((current) => ({
      ...current,
      heldVendors: payoutHold
        ? [...current.heldVendors.filter((held) => held.id !== vendor.id), vendor]
        : current.heldVendors.filter((held) => held.id !== vendor.id),
    }));
  }

  const noticeText = noticeDraft.trim();
  const noticeValid =
    noticeText !== '' &&
    noticeText.length <= PLATFORM_NOTICE_MAX_LENGTH &&
    !/[<>]/.test(noticeText);
  const noticeUnchanged =
    noticeText === (confirmed.noticeMessage ?? '') && noticeTone === confirmed.noticeTone;

  const capCents = Math.round(Number(capDollars) * CENTS_PER_DOLLAR);
  const capValid =
    capDollars.trim() !== '' &&
    Number.isFinite(capCents) &&
    capCents > 0 &&
    capCents <= MAX_PACKAGE_PRICE_CENTS;

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex max-w-[720px] flex-col gap-5">
        <p className="text-sm text-stone-600">
          {confirmed.updatedAt && confirmed.updatedByName
            ? `Last changed by ${confirmed.updatedByName}, ${WHEN.format(confirmed.updatedAt)}.`
            : 'Never changed. Every switch is off and there is no cap.'}{' '}
          Every change is recorded in Activity and emailed to the admin.
        </p>

        {failure ? (
          <p role="alert" className="text-sm font-semibold text-error-500">
            {failure}
          </p>
        ) : null}

        <section
          aria-labelledby={`${fieldId}-switches`}
          className="rounded-xl border border-stone-300 bg-stone-0"
        >
          <h2 id={`${fieldId}-switches`} className="sr-only">
            Launch switches
          </h2>
          <ul className="divide-y divide-stone-200">
            {SWITCHES.map((item) => (
              <li key={item.field} className="flex items-start justify-between gap-6 px-4 py-3.5">
                <div>
                  <label
                    htmlFor={`${fieldId}-${item.field}`}
                    className="text-base font-semibold text-stone-900"
                  >
                    {item.label}
                  </label>
                  <p className="mt-1 text-sm text-stone-600">{item.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5 pt-0.5">
                  <span className="text-sm text-stone-700" aria-hidden="true">
                    {confirmed[item.field] ? 'Paused' : 'Running'}
                  </span>
                  <Switch
                    id={`${fieldId}-${item.field}`}
                    checked={confirmed[item.field]}
                    disabled={saving}
                    onCheckedChange={(checked) => void save({ [item.field]: checked })}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby={`${fieldId}-vendor-gate`}
          className="rounded-xl border border-stone-300 bg-stone-0 px-4 py-3.5"
        >
          <div className="flex items-start justify-between gap-6">
            <div>
              <label
                id={`${fieldId}-vendor-gate`}
                htmlFor={`${fieldId}-vendorInviteOnly`}
                className="text-base font-semibold text-stone-900"
              >
                Vendors join by invitation only
              </label>
              <p className="mt-1 text-sm text-stone-600">
                {confirmed.vendorInviteOnly
                  ? 'A vendor account is created only for an invited email. Anyone else choosing vendor is sent to the application form; customers sign up as usual.'
                  : 'Anyone can sign up as a vendor. Customers are never gated.'}{' '}
                <Link
                  href="/admin/vendor-applications"
                  className="font-semibold text-clay-500 underline underline-offset-4"
                >
                  Applications and invites
                </Link>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5 pt-0.5">
              <span className="text-sm text-stone-700" aria-hidden="true">
                {confirmed.vendorInviteOnly ? 'Invite only' : 'Open'}
              </span>
              <Switch
                id={`${fieldId}-vendorInviteOnly`}
                checked={confirmed.vendorInviteOnly}
                disabled={saving}
                onCheckedChange={(checked) => void save({ vendorInviteOnly: checked })}
              />
            </div>
          </div>
        </section>

        <section
          aria-labelledby={`${fieldId}-notice-heading`}
          className="rounded-xl border border-stone-300 bg-stone-0 px-4 py-3.5"
        >
          <h2 id={`${fieldId}-notice-heading`} className="text-base font-semibold text-stone-900">
            Site-wide notice
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {confirmed.noticeMessage === null
              ? 'No notice is posted. While checkout or booking requests are paused, visitors see a default notice instead.'
              : 'Every visitor sees this above the navigation within a minute. Each can dismiss it for their session.'}
          </p>
          <form
            noValidate
            className="mt-3 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (noticeValid && !noticeUnchanged) {
                void save({ noticeMessage: noticeText, noticeTone });
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${fieldId}-notice`} className="text-sm font-semibold text-stone-700">
                Notice text
              </label>
              <textarea
                id={`${fieldId}-notice`}
                rows={3}
                maxLength={PLATFORM_NOTICE_MAX_LENGTH}
                value={noticeDraft}
                onChange={(event) => setNoticeDraft(event.target.value)}
                aria-describedby={`${fieldId}-notice-count`}
                className="w-full resize-y rounded-lg border border-stone-300 bg-stone-0 px-3 py-2 text-sm text-stone-900"
              />
              <p id={`${fieldId}-notice-count`} className="text-sm text-stone-600">
                {noticeDraft.length} of {PLATFORM_NOTICE_MAX_LENGTH} characters. Plain text: no
                links or markup.
              </p>
            </div>
            <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <legend className="mb-1.5 text-sm font-semibold text-stone-700">Tone</legend>
              {PLATFORM_NOTICE_TONES.map((tone) => (
                <label key={tone} className="flex items-center gap-2 text-sm text-stone-900">
                  <input
                    type="radio"
                    name={`${fieldId}-tone`}
                    value={tone}
                    checked={noticeTone === tone}
                    onChange={() => setNoticeTone(tone)}
                  />
                  {tone === 'info' ? 'Information' : 'Warning (announced to screen readers)'}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={saving || !noticeValid || noticeUnchanged}
              >
                Post notice
              </Button>
              {confirmed.noticeMessage !== null ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    setNoticeDraft('');
                    void save({ noticeMessage: null });
                  }}
                >
                  Clear notice
                </Button>
              ) : null}
            </div>
          </form>
        </section>

        <section
          aria-labelledby={`${fieldId}-cap-heading`}
          className="rounded-xl border border-stone-300 bg-stone-0 px-4 py-3.5"
        >
          <h2 id={`${fieldId}-cap-heading`} className="text-base font-semibold text-stone-900">
            Beta cap on booking value
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {confirmed.maxBookingCents === null
              ? 'No cap. Any price a vendor sets can be requested and paid.'
              : `New requests and payments over ${formatPrice(confirmed.maxBookingCents)} are refused, including on requests made before the cap was set. A checkout already open can still complete.`}
          </p>
          <form
            noValidate
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (capValid) {
                void save({ maxBookingCents: capCents });
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${fieldId}-cap`} className="text-sm font-semibold text-stone-700">
                Cap in US dollars
              </label>
              <Input
                id={`${fieldId}-cap`}
                inputMode="decimal"
                value={capDollars}
                onChange={(event) => setCapDollars(event.target.value)}
                className="w-40"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" disabled={saving || !capValid}>
              Save cap
            </Button>
            {confirmed.maxBookingCents !== null ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setCapDollars('');
                  void save({ maxBookingCents: null });
                }}
              >
                Remove cap
              </Button>
            ) : null}
          </form>
        </section>

        <HeldVendors settings={confirmed} saving={saving} run={run} onHoldChange={applyHold} />
      </div>
    </div>
  );
}

interface HeldVendorsProps {
  settings: WireAdminPlatformSettings;
  saving: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
  /** Applies a hold PUT's confirmed result to the parent's local state. */
  onHoldChange: (vendor: HeldVendorEntry, payoutHold: boolean) => void;
}

/** Vendors whose automatic payouts are held, and the search that adds one. */
function HeldVendors({
  settings,
  saving,
  run,
  onHoldChange,
}: HeldVendorsProps): React.ReactElement {
  const call = useApi();
  const fieldId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly WireAdminVendorRow[] | null>(null);
  const heldIds = new Set(settings.heldVendors.map((vendor) => vendor.id));

  function setHold(vendor: HeldVendorEntry, payoutHold: boolean): Promise<void> {
    return run(async () => {
      await call(`/admin/vendors/${vendor.id}/payout-hold`, {
        method: 'PUT',
        body: { payoutHold },
        schema: adminVendorPayoutHoldResultSchema,
      });
      onHoldChange(vendor, payoutHold);
    });
  }

  function search(): Promise<void> {
    const params = new URLSearchParams({
      q: query.trim(),
      pageSize: String(VENDOR_SEARCH_PAGE_SIZE),
    });

    return run(async () => {
      const page = await call(`/admin/vendors?${params.toString()}`, {
        schema: wireAdminVendorPageSchema,
      });
      setResults(page.items);
    });
  }

  return (
    <section
      aria-labelledby={`${fieldId}-held`}
      className="rounded-xl border border-stone-300 bg-stone-0 px-4 py-3.5"
    >
      <h2 id={`${fieldId}-held`} className="text-base font-semibold text-stone-900">
        Vendors on payout hold
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        The sweep skips a held vendor&apos;s payouts. They stay due and release on the next sweep
        after the hold is lifted.
      </p>

      {settings.heldVendors.length === 0 ? (
        <p className="mt-3 text-sm text-stone-700">No vendor&apos;s payouts are held.</p>
      ) : (
        <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
          {settings.heldVendors.map((vendor) => (
            <li key={vendor.id} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm font-semibold text-stone-900">{vendor.businessName}</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={() => void setHold(vendor, false)}
              >
                Release hold
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        noValidate
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim() !== '') {
            void search();
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-search`} className="text-sm font-semibold text-stone-700">
            Find a vendor to hold
          </label>
          <Input
            id={`${fieldId}-search`}
            type="search"
            maxLength={MAX_NAME_LENGTH}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Business name or slug"
            className="w-64"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={saving || query.trim() === ''}
        >
          Find vendor
        </Button>
      </form>

      {results !== null && (
        <>
          {results.length === 0 ? (
            <p className="mt-3 text-sm text-stone-700">No vendor matches that search.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-200 border-y border-stone-200">
              {results.map((vendor) => (
                <li key={vendor.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-sm text-stone-900">
                    <span className="font-semibold">{vendor.businessName}</span>{' '}
                    <span className="font-mono text-stone-600">{vendor.slug}</span>
                  </span>
                  {heldIds.has(vendor.id) ? (
                    <span className="text-sm text-stone-600">Held</span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => void setHold(vendor, true)}
                    >
                      Hold payouts
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
