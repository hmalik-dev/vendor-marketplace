'use client';

import {
  centsToDollars,
  createServicePackageSchema,
  dollarsToCents,
  MAX_GUEST_COUNT,
  PRICE_TYPES,
  updateServicePackageSchema,
  type PriceType,
} from '@vendor-marketplace/shared';
import { Plus, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { wireServicePackageSchema, type WireServicePackage } from '@/lib/wire-schemas';
import { Button } from '@/components/ui/button';
import { Input, INPUT_TOUCH_HEIGHT } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  fixed: 'Fixed price',
  starting_at: 'Starting at',
  hourly: 'Per hour',
};

const MAX_INCLUSIONS = 20;
const MAX_INCLUSION_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5_000;

export interface PackageFormProps {
  /** `null` while the vendor is drafting a package that does not exist yet. */
  servicePackage: WireServicePackage | null;
  onSaved: (saved: WireServicePackage) => void;
  onCancel: () => void;
}

interface FormState {
  name: string;
  description: string;
  priceDollars: string;
  priceType: PriceType;
  durationHours: string;
  maxGuests: string;
  inclusions: string[];
}

function initialState(servicePackage: WireServicePackage | null): FormState {
  return {
    name: servicePackage?.name ?? '',
    description: servicePackage?.description ?? '',
    priceDollars: servicePackage === null ? '' : String(centsToDollars(servicePackage.priceCents)),
    priceType: servicePackage?.priceType ?? 'fixed',
    durationHours:
      servicePackage?.durationHours === null || servicePackage?.durationHours === undefined
        ? ''
        : String(servicePackage.durationHours),
    maxGuests:
      servicePackage?.maxGuests === null || servicePackage?.maxGuests === undefined
        ? ''
        : String(servicePackage.maxGuests),
    inclusions: [...(servicePackage?.inclusions ?? [])],
  };
}

/**
 * Reads an optional number field. A blank field means "not specified"; the
 * schemas reject anything else that is not a number, so a typo surfaces as a
 * field error rather than being silently dropped.
 */
function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toPayload(form: FormState): Record<string, unknown> {
  const dollars = Number(form.priceDollars.trim());

  return {
    name: form.name.trim(),
    description: form.description.trim(),
    // `NaN` fails the schema's integer check, so a non-numeric price is caught
    // by validation rather than reaching the API as `null`.
    priceCents: Number.isFinite(dollars) ? dollarsToCents(dollars) : Number.NaN,
    priceType: form.priceType,
    durationHours: optionalNumber(form.durationHours),
    maxGuests: optionalNumber(form.maxGuests),
    inclusions: form.inclusions.map((item) => item.trim()).filter((item) => item !== ''),
  };
}

/**
 * The editor pane of the package manager. It edits one package at a time and
 * hands the saved row back to the manager, which owns the list.
 */
export function PackageForm({
  servicePackage,
  onSaved,
  onCancel,
}: PackageFormProps): React.ReactElement {
  const request = useApi();
  const fieldId = useId();
  const [form, setForm] = useState<FormState>(() => initialState(servicePackage));
  const [isSaving, setIsSaving] = useState(false);
  /*
   * The price band is checked here, not only at the server. `40-states.md`:
   * validation errors belong on the field after a submit attempt, never in a
   * toast and never while typing — so this is set on submit and cleared the
   * moment the vendor edits the field.
   */
  const [priceError, setPriceError] = useState<string | null>(null);

  const isNew = servicePackage === null;

  // Selecting a different package replaces what the pane is editing.
  useEffect(() => {
    setForm(initialState(servicePackage));
    setPriceError(null);
  }, [servicePackage]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const updateInclusion = (index: number, value: string): void => {
    setForm((previous) => ({
      ...previous,
      inclusions: previous.inclusions.map((item, at) => (at === index ? value : item)),
    }));
  };

  const removeInclusion = (index: number): void => {
    setForm((previous) => ({
      ...previous,
      inclusions: previous.inclusions.filter((_item, at) => at !== index),
    }));
  };

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const payload = toPayload(form);
    const schema = isNew ? createServicePackageSchema : updateServicePackageSchema;
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      const issues = parsed.error.issues;
      const price = issues.find((issue) => issue.path[0] === 'priceCents');

      setPriceError(price?.message ?? null);

      /*
       * A field that shows its own error does not also raise a toast. The
       * toast is for what has no field to sit on — and if price was the only
       * problem, there is nothing left to say twice.
       */
      const elsewhere = issues.find((issue) => issue.path[0] !== 'priceCents');

      if (elsewhere) {
        toast.error(elsewhere.message);
      }

      return;
    }

    setPriceError(null);

    setIsSaving(true);
    try {
      const saved = await request(
        isNew ? '/vendor/packages' : `/vendor/packages/${servicePackage.id}`,
        {
          method: isNew ? 'POST' : 'PUT',
          body: parsed.data,
          schema: wireServicePackageSchema,
        },
      );

      toast.success(isNew ? 'Package added.' : 'Package saved.');
      onSaved(saved);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not save that package.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void save(event)} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <h2 className="font-display text-lg font-semibold text-stone-800">
          {isNew ? 'New package' : 'Edit package'}
        </h2>

        <div className="field-grid mt-4">
          <div className="sm:col-span-2">
            <Label htmlFor={`${fieldId}-name`}>Package name</Label>
            <Input
              id={`${fieldId}-name`}
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Half-day coverage"
              required
              maxLength={200}
              className={cn('mt-1.5', INPUT_TOUCH_HEIGHT)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor={`${fieldId}-description`}>What it includes, in a sentence or two</Label>
            <Textarea
              id={`${fieldId}-description`}
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Four hours of documentary coverage, a second shooter, and an online gallery within three weeks."
              required
              maxLength={MAX_DESCRIPTION_LENGTH}
              className="mt-1.5 min-h-[110px]"
            />
          </div>

          <div>
            <Label htmlFor={`${fieldId}-price`}>Price</Label>
            <InputGroup className="mt-1.5 h-11 lg:h-8">
              <InputGroupAddon align="inline-start">$</InputGroupAddon>
              <InputGroupInput
                id={`${fieldId}-price`}
                value={form.priceDollars}
                onChange={(event) => {
                  update('priceDollars', event.target.value);
                  setPriceError(null);
                }}
                inputMode="decimal"
                placeholder="1200"
                required
                aria-invalid={priceError !== null || undefined}
                aria-describedby={priceError === null ? undefined : `${fieldId}-price-error`}
              />
            </InputGroup>
            {priceError === null ? (
              <p className="mt-1 text-xs text-stone-600">Between $25 and $100,000.</p>
            ) : (
              <p id={`${fieldId}-price-error`} role="alert" className="mt-1 text-xs text-error-500">
                {priceError}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor={`${fieldId}-priceType`}>How it is priced</Label>
            <Select
              value={form.priceType}
              onValueChange={(value) => update('priceType', value as PriceType)}
            >
              <SelectTrigger
                id={`${fieldId}-priceType`}
                className="mt-1.5 w-full data-[size=default]:h-11 lg:data-[size=default]:h-8"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_TYPES.map((priceType) => (
                  <SelectItem key={priceType} value={priceType}>
                    {PRICE_TYPE_LABELS[priceType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor={`${fieldId}-duration`}>Duration (hours)</Label>
            <Input
              id={`${fieldId}-duration`}
              value={form.durationHours}
              onChange={(event) => update('durationHours', event.target.value)}
              inputMode="decimal"
              placeholder="Optional"
              className={cn('mt-1.5', INPUT_TOUCH_HEIGHT)}
            />
          </div>

          <div>
            <Label htmlFor={`${fieldId}-guests`}>Maximum guests</Label>
            <Input
              id={`${fieldId}-guests`}
              value={form.maxGuests}
              onChange={(event) => update('maxGuests', event.target.value)}
              inputMode="numeric"
              placeholder="Optional"
              max={MAX_GUEST_COUNT}
              className={cn('mt-1.5', INPUT_TOUCH_HEIGHT)}
            />
          </div>

          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-stone-800">What&rsquo;s included</legend>
            <p className="mt-1 text-xs text-stone-600">
              One line per thing the customer gets. Up to {MAX_INCLUSIONS}.
            </p>

            <ul className="mt-2 space-y-2">
              {form.inclusions.map((inclusion, index) => (
                /*
                 * Position is the identity here: these are free-text lines with
                 * no id, and two identical lines are a legitimate transient
                 * state while one of them is being typed.
                 */
                <li key={index} className="flex items-center gap-2">
                  <Input
                    value={inclusion}
                    onChange={(event) => updateInclusion(index, event.target.value)}
                    aria-label={`Included item ${index + 1}`}
                    maxLength={MAX_INCLUSION_LENGTH}
                    className={INPUT_TOUCH_HEIGHT}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 lg:size-8"
                    aria-label={`Remove included item ${index + 1}`}
                    onClick={() => removeInclusion(index)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 h-11 lg:h-7"
              disabled={form.inclusions.length >= MAX_INCLUSIONS}
              onClick={() => update('inclusions', [...form.inclusions, ''])}
            >
              <Plus aria-hidden="true" />
              Add an item
            </Button>
          </fieldset>
        </div>
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center justify-end gap-3 border-t border-stone-300 bg-stone-50/95 px-5 py-3 sm:px-6',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          className="h-11 lg:h-8"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : isNew ? 'Add package' : 'Save package'}
        </Button>
      </div>
    </form>
  );
}
