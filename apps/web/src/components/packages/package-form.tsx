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
import { useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PRICE_TYPE_LABELS } from '@/lib/package-labels';

export { PRICE_TYPE_LABELS };
import { NO_PACKAGE_PROBLEM, packageProblemFrom } from '@/lib/package-issues';
import { userFacingError } from '@/lib/user-facing-error';
import { useSubmitValidation } from '@/lib/use-submit-validation';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { wireServicePackageSchema, type WireServicePackage } from '@/lib/wire-schemas';
import {
  errorProps,
  FieldMessage,
  FormErrorCard,
  FormErrorSummary,
} from '@/components/form-error-summary';
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

  const isNew = servicePackage === null;

  /*
   * Recomputed from the current values on every render, exactly as the
   * storefront editor and the booking request screen do it: a corrected field
   * stops producing an issue and its message disappears on its own, with no
   * per-field bookkeeping to get wrong.
   *
   * #388 replaced a single `priceError` string with this. The old shape could
   * only ever describe one field, so a blank name and a blank description had
   * nowhere to be said and became a toast — or, once the browser's own
   * validation cancelled the submit first, nothing at all.
   */
  const problem = useMemo(() => {
    const schema = isNew ? createServicePackageSchema : updateServicePackageSchema;
    const parsed = schema.safeParse(toPayload(form));

    return parsed.success ? NO_PACKAGE_PROBLEM : packageProblemFrom(parsed.error.issues, fieldId);
  }, [form, isNew, fieldId]);

  const validation = useSubmitValidation(problem.fields);
  /** Nothing is said in red before a submit attempt (`40-states.md`). */
  const formMessage = validation.attempted ? problem.formMessage : null;

  // Selecting a different package replaces what the pane is editing.
  useEffect(() => {
    setForm(initialState(servicePackage));
    validation.reset();
    // `validation` is recreated every render; only the selection should reseed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const send = async (): Promise<void> => {
    const schema = isNew ? createServicePackageSchema : updateServicePackageSchema;
    const parsed = schema.safeParse(toPayload(form));

    /*
     * `problem` is computed from the same values by the same schema, so a
     * failure here cannot happen — `attemptSubmit` only calls this when the
     * blocker list is empty. Narrowing rather than asserting keeps that true
     * by construction instead of by comment.
     */
    if (!parsed.success) {
      return;
    }

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
      toast.error(userFacingError(error, 'Could not save that package.'));
    } finally {
      setIsSaving(false);
    }
  };

  /** Read once per render; every field below is looked up by its control id. */
  const issueFor = validation.issueFor;
  const priceIssue = issueFor(`${fieldId}-price`);

  const save = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    validation.attemptSubmit(() => {
      // A rule on a field this pane does not lay out still has to stop the
      // save; it is said at form level instead of on a control.
      if (problem.formMessage !== null) {
        return;
      }

      void send();
    });
  };

  return (
    /*
      `noValidate` is load-bearing (#388). The `required` attributes below stay —
      they are what tells a screen reader a field is required *before* it blocks
      anything — but the browser's own enforcement of them cancelled the submit
      before React saw it, so nothing below ever ran and the button read as
      inert. This pane judges every field itself.
    */
    <form onSubmit={save} noValidate className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <h2 className="font-display text-lg font-semibold text-stone-800">
          {isNew ? 'New package' : 'Edit package'}
        </h2>

        {validation.attempted && validation.blockers.length > 0 ? (
          <div className="mt-4">
            <FormErrorSummary blockers={validation.blockers} />
          </div>
        ) : null}

        {formMessage !== null ? (
          <div className="mt-4">
            <FormErrorCard>
              <p className="text-base text-stone-900">{formMessage}</p>
            </FormErrorCard>
          </div>
        ) : null}

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
              {...errorProps(issueFor(`${fieldId}-name`))}
            />
            <FieldMessage issue={issueFor(`${fieldId}-name`)} />
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
              {...errorProps(issueFor(`${fieldId}-description`))}
            />
            <FieldMessage issue={issueFor(`${fieldId}-description`)} />
          </div>

          <div>
            <Label htmlFor={`${fieldId}-price`}>Price</Label>
            <InputGroup className="mt-1.5 h-11 lg:h-8">
              <InputGroupAddon align="inline-start">$</InputGroupAddon>
              <InputGroupInput
                id={`${fieldId}-price`}
                value={form.priceDollars}
                onChange={(event) => update('priceDollars', event.target.value)}
                inputMode="decimal"
                placeholder="1200"
                required
                {...errorProps(priceIssue, ...(priceIssue ? [] : [`${fieldId}-price-help`]))}
              />
            </InputGroup>
            {priceIssue === null ? (
              <p
                id={`${fieldId}-price-help`}
                className="mt-1 text-xs leading-normal text-stone-600"
              >
                Between $25 and $100,000.
              </p>
            ) : (
              <FieldMessage issue={priceIssue} />
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
              {...errorProps(issueFor(`${fieldId}-duration`))}
            />
            <FieldMessage issue={issueFor(`${fieldId}-duration`)} />
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
              {...errorProps(issueFor(`${fieldId}-guests`))}
            />
            <FieldMessage issue={issueFor(`${fieldId}-guests`)} />
          </div>

          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-stone-800">What&rsquo;s included</legend>
            <p className="mt-1 text-xs leading-normal text-stone-600">
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
