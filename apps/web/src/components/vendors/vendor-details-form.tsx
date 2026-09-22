'use client';

import {
  MAX_BUSINESS_NAME_LENGTH,
  MAX_NAME_LENGTH,
  MAX_VENDOR_APPLICATION_MESSAGE_LENGTH,
  vendorApplicationInputSchema,
  vendorApplicationReceiptSchema,
  WAITLIST_PATH,
  type Category,
  type MyVendorApplication,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { FIELD_FOCUS } from '@/lib/focus';
import { US_STATE_OPTIONS, usStateName } from '@/lib/us-states';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { StatusPill } from '@/components/ui/status-pill';
import { useApi } from '@/lib/use-api';
import { userFacingError } from '@/lib/user-facing-error';

export interface VendorDetailsFormProps {
  /** The row the gate already seeded — a submit fills it in, never creates it. */
  application: MyVendorApplication;
  categories: readonly Category[];
}

const SELECT_TRIGGER = cn(
  'mt-1.5 flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-stone-0 px-[13px] text-base text-stone-900 outline-none sm:h-[38px]',
  FIELD_FOCUS,
);
const LABEL = 'text-sm font-semibold text-stone-700';

/**
 * "Tell us about your business" — the details a refused vendor gives once they
 * are already on the waitlist (VEN-512). Business name, category and city are
 * required to be **invitable**; the link to their work is the only optional
 * field besides state.
 */
export function VendorDetailsForm({
  application,
  categories,
}: VendorDetailsFormProps): React.ReactElement {
  const call = useApi();
  const router = useRouter();
  const fieldId = useId();

  const [businessName, setBusinessName] = useState(application.businessName ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(application.category);
  const [city, setCity] = useState(application.city ?? '');
  const [state, setState] = useState<string | null>(application.state);
  const [message, setMessage] = useState(application.message ?? '');
  const [openSelect, setOpenSelect] = useState<'category' | 'state' | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }));

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    const parsed = vendorApplicationInputSchema.safeParse({
      email: application.email,
      businessName,
      category: categoryId,
      city,
      state: state ?? undefined,
      message: message.trim() === '' ? undefined : message,
    });

    if (!parsed.success) {
      setProblem('Give your business name, what you offer and your city.');
      return;
    }

    setSaving(true);
    setProblem(null);

    try {
      await call('/vendor-applications', {
        method: 'POST',
        body: parsed.data,
        schema: vendorApplicationReceiptSchema,
      });
      router.replace(WAITLIST_PATH);
    } catch (error) {
      setProblem(
        userFacingError(error, "You're not on the waitlist yet — nothing saved. Try again."),
      );
      setSaving(false);
    }
  }

  return (
    // `noValidate`: this form owns its submit (#388).
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {problem ? (
        <Banner status="failed" title="Not saved">
          {problem}
        </Banner>
      ) : null}

      <div className="flex flex-col gap-1.5">
        {/*
          Not `<label htmlFor>`: this row is a locked, read-only fact rather
          than a form control — "reassurance, not a field" (frame `36`) — so
          there is no input for a `for` to target, the same reasoning that
          gives Category and State a plain labelling `<span>` below.
        */}
        <span id={`${fieldId}-email-label`} className={LABEL}>
          Your email
        </span>
        <div
          aria-labelledby={`${fieldId}-email-label`}
          className="flex items-center justify-between gap-2.5 rounded-lg border border-stone-300 bg-stone-150 px-3.25 py-2.5"
        >
          <span className="text-[13.5px] text-stone-700">{application.email}</span>
          <StatusPill tone="confirmed" className="shrink-0">
            Verified
          </StatusPill>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${fieldId}-business`} className={LABEL}>
          Business name
        </label>
        <Input
          id={`${fieldId}-business`}
          autoComplete="organization"
          maxLength={MAX_BUSINESS_NAME_LENGTH}
          value={businessName}
          onChange={(event) => setBusinessName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={`${fieldId}-category-label`} className={LABEL}>
          Category
        </span>
        <SingleSelectDropdown
          open={openSelect === 'category'}
          onOpenChange={(next) => setOpenSelect(next ? 'category' : null)}
          label="Category"
          countNoun="categories"
          options={categoryOptions}
          value={categoryId}
          onChange={setCategoryId}
          trigger={
            <button
              type="button"
              id={`${fieldId}-category`}
              aria-haspopup="listbox"
              aria-expanded={openSelect === 'category'}
              aria-labelledby={`${fieldId}-category-label`}
              data-focus-own
              className={cn(SELECT_TRIGGER, categoryId === null && 'text-stone-600')}
            >
              {categoryId === null
                ? 'Choose a category'
                : (categoryOptions.find((option) => option.value === categoryId)?.label ??
                  categoryId)}
            </button>
          }
        />
      </div>

      {/* One answer, two fields — frame `36`'s 1.35fr/1fr row. */}
      <div className="grid grid-cols-[1.35fr_1fr] gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${fieldId}-city`} className={LABEL}>
            City
          </label>
          <Input
            id={`${fieldId}-city`}
            autoComplete="address-level2"
            maxLength={MAX_NAME_LENGTH}
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={`${fieldId}-state-label`} className={LABEL}>
            State
          </span>
          <SingleSelectDropdown
            open={openSelect === 'state'}
            onOpenChange={(next) => setOpenSelect(next ? 'state' : null)}
            label="State"
            countNoun="states"
            options={US_STATE_OPTIONS}
            value={state}
            onChange={setState}
            trigger={
              <button
                type="button"
                id={`${fieldId}-state`}
                aria-haspopup="listbox"
                aria-expanded={openSelect === 'state'}
                aria-labelledby={`${fieldId}-state-label`}
                data-focus-own
                className={cn(SELECT_TRIGGER, state === null && 'text-stone-600')}
              >
                {state === null ? 'Choose a state' : usStateName(state)}
              </button>
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${fieldId}-message`} className={LABEL}>
          Link to your work <span className="font-normal text-stone-600">— optional</span>
        </label>
        <Input
          id={`${fieldId}-message`}
          maxLength={MAX_VENDOR_APPLICATION_MESSAGE_LENGTH}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <span className="text-[11.5px] text-stone-600">Instagram, a website</span>
      </div>

      <Button type="submit" variant="primary" size="lg" disabled={saving} loading={saving}>
        {saving ? 'Saving…' : 'Add me to the waitlist'}
      </Button>
    </form>
  );
}
