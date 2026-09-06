'use client';

import {
  BUDGET_TIERS,
  BUDGET_TIER_LABELS,
  MAX_CUSTOMER_BIO_LENGTH,
  MAX_GUEST_COUNT,
  MAX_NAME_LENGTH,
  updateUserSchema,
  type BudgetTier,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { FieldMessage, errorProps } from '@/components/form-error-summary';
import { ImageUpload } from '@/components/image-upload';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { Button } from '@/components/ui/button';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError } from '@/lib/api-client';
import { guestCountFromInput } from '@/lib/guest-count';
import { useApi } from '@/lib/use-api';
import type { FieldIssue } from '@/lib/use-submit-validation';
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes-guard';
import { wireUserSchema, type WireUser } from '@/lib/wire-schemas';
import { FIELD_FOCUS } from '@/lib/focus';
import { cn } from '@/lib/utils';

export interface CustomerProfileFormProps {
  user: WireUser;
}

const FIELD = cn(
  'h-auto w-full rounded-[10px] border border-stone-300 bg-stone-150 px-3.25 py-2.5 text-base text-stone-900',
  FIELD_FOCUS,
);

const LABEL = 'mb-1.5 text-label font-semibold tracking-label text-stone-600 uppercase';

/**
 * What each field is called on screen, keyed by the name the schema uses.
 *
 * A validation failure is shown as `<label>: <reason>`. Without this the only
 * text on screen was Zod's own top-level default — a bare `Invalid input`
 * naming no field, above six inputs of which exactly one was wrong.
 */
const FIELD_LABELS = {
  bio: 'About you',
  city: 'City',
  state: 'State',
  budgetTier: 'Typical budget',
  typicalGuestCountMin: 'Guests, from',
  typicalGuestCountMax: 'Guests, up to',
  avatarUrl: 'Profile photo',
} satisfies Record<string, string>;

type FormField = keyof typeof FIELD_LABELS;

/**
 * The control each schema field is rendered by, suffixing this form's `useId`.
 *
 * `errorProps` ties a control to its message by id, so a failure the schema
 * reports under `typicalGuestCountMin` has to find the input that holds it.
 *
 * **Only the fields with a text control are here.** `avatarUrl` is an
 * `ImageUpload` — a group of buttons, and `aria-invalid` is inert on a generic
 * element — and `budgetTier` is a fixed option list; neither can be reached by
 * typing, so neither is given a mapping it would never use. A refusal under
 * one of them still names its field in the line below the button, which is the
 * only place it could go.
 */
const FIELD_IDS = {
  bio: 'bio',
  city: 'city',
  state: 'state',
  typicalGuestCountMin: 'guest-min',
  typicalGuestCountMax: 'guest-max',
} satisfies Partial<Record<FormField, string>>;

function isFormField(value: unknown): value is FormField {
  return typeof value === 'string' && Object.hasOwn(FIELD_LABELS, value);
}

function hasControl(field: FormField): field is keyof typeof FIELD_IDS {
  return Object.hasOwn(FIELD_IDS, field);
}

/** `100,000`, grouped once — the constant cannot change between renders. */
const GUEST_CEILING = MAX_GUEST_COUNT.toLocaleString('en-US');

/**
 * Why this guest count cannot be saved, or `null` when it can.
 *
 * `type="number"` accepts far more than the spinner suggests: `2.7` and `1e21`
 * both reach `onChange` intact, and were then run through `Number.parseInt`,
 * which stops at the first character it cannot use — `2.7` was stored as **2**
 * and `1e21` as **1**, under a `Profile saved` toast, with the input still
 * showing what the customer typed. The stored range and the screen disagreed
 * and nothing said so.
 *
 * `guestCountFromInput` is the rule, not a regex written here — it lives beside
 * the URL boundary's parser so the bounds are stated once, and it refuses the
 * shapes `Number.parseInt` accepted by prefix (`2.7`, `1e21`, `120abc`). Only
 * the message string is local.
 *
 * `40-states.md` prefers a blocker the reader cannot cross to a message
 * explaining that they did, so this drives a disabled button rather than a
 * refusal after the round trip — the same shape the inverted range already had.
 */
function guestCountIssue(raw: string, field: string, label: string): FieldIssue | null {
  if (raw === '' || guestCountFromInput(raw) !== null) {
    return null;
  }

  return {
    field,
    label,
    severity: 'blocker',
    message: `${label} has to be a whole number of people, from 1 to ${GUEST_CEILING}.`,
  };
}

/**
 * What a customer chooses to tell vendors about themselves.
 *
 * Every field is optional: the marketplace has to work for someone who books
 * without ever opening this page, so nothing here gates anything. The fields
 * exist because a vendor deciding whether to accept a request is judging a
 * person they cannot see, and a filled-in profile is the only thing that makes
 * that judgement anything other than a guess.
 */
export function CustomerProfileForm({ user }: CustomerProfileFormProps): React.ReactElement {
  const fieldId = useId();
  const request = useApi();
  const router = useRouter();

  const [bio, setBio] = useState(user.bio ?? '');
  const [city, setCity] = useState(user.city ?? '');
  const [state, setState] = useState(user.state ?? '');
  const [budgetTier, setBudgetTier] = useState<BudgetTier | ''>(user.budgetTier ?? '');
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [guestMin, setGuestMin] = useState(user.typicalGuestCountMin?.toString() ?? '');
  const [guestMax, setGuestMax] = useState(user.typicalGuestCountMax?.toString() ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * The field the server-shaped failure belongs to, so its input carries
   * `aria-invalid` and an `aria-describedby` pointing at the message — a screen
   * reader that never reaches the sentence still hears that the control it is
   * on is the wrong one. Zod's own top-level default, `Invalid input`, named no
   * field at all.
   */
  const [schemaIssue, setSchemaIssue] = useState<FieldIssue | null>(null);

  /*
   * The whole form as one value, written once. `saved` holds what the server
   * last acknowledged; the two are compared to decide whether leaving costs
   * anything, and `save` promotes one to the other. Listing the fields in three
   * places instead would mean a new field silently escaping the leave guard.
   */
  const current = { bio, city, state, budgetTier, guestMin, guestMax, avatarUrl };
  const [saved, setSaved] = useState(current);
  const isDirty = JSON.stringify(current) !== JSON.stringify(saved);

  /*
   * The same guard the vendor's storefront editor uses (#227). This form drew
   * no prompt of any kind: a sidebar click, a typed URL or a reload discarded
   * the draft silently, and Back returned to the last saved value with the
   * edit gone.
   */
  const guard = useUnsavedChangesGuard(isDirty, { navigate: (href) => router.push(href) });

  const guestMinId = `${fieldId}-guest-min`;
  const guestMaxId = `${fieldId}-guest-max`;

  const guestMinIssue = guestCountIssue(guestMin, guestMinId, FIELD_LABELS.typicalGuestCountMin);
  const guestMaxIssue = guestCountIssue(guestMax, guestMaxId, FIELD_LABELS.typicalGuestCountMax);
  /*
   * Only meaningful once both are whole numbers. `Number('1e21') > Number('2')`
   * is a comparison between a value that will never be saved and one that will.
   */
  const rangeIssue: FieldIssue | null =
    guestMinIssue === null &&
    guestMaxIssue === null &&
    guestMin !== '' &&
    guestMax !== '' &&
    Number(guestMin) > Number(guestMax)
      ? {
          field: guestMinId,
          label: FIELD_LABELS.typicalGuestCountMin,
          severity: 'blocker',
          message: 'The smaller number goes first — swap them and this will save.',
        }
      : null;

  /*
   * Everything stopping a save, in field order. Red the moment it is true
   * rather than after a submit attempt: `40-states.md` prefers a blocker the
   * reader cannot cross, which is the idiom the inverted range already used on
   * this screen, so `useSubmitValidation`'s attempt-gated model would be a
   * second answer here rather than the shared one.
   */
  /*
   * The bio is the one field on this form that can still reach the schema by
   * typing: City and State carry `maxLength`, and the counter below the
   * textarea is designed to read `301 / 300` rather than stop at 300. So the
   * over-length case is named here, beside the counter that is already showing
   * red, instead of after a round trip — `40-states.md` again preferring a
   * blocker the reader cannot cross.
   */
  const bioIssue: FieldIssue | null =
    bio.trim().length > MAX_CUSTOMER_BIO_LENGTH
      ? {
          field: `${fieldId}-bio`,
          label: FIELD_LABELS.bio,
          severity: 'blocker',
          message: `Keep this to ${MAX_CUSTOMER_BIO_LENGTH} characters or fewer.`,
        }
      : null;

  const blockers = [bioIssue, guestMinIssue ?? rangeIssue, guestMaxIssue].filter(
    (issue): issue is FieldIssue => issue !== null,
  );

  /*
   * The schema's own refusal is shown but does not disable the button: it is
   * the last attempt's result, and the customer's next keystroke is what
   * answers it. Only a live blocker holds the control shut.
   */
  const issues = schemaIssue === null ? blockers : [...blockers, schemaIssue];

  /** The issue to render under a control, or `null`. */
  function issueFor(field: string): FieldIssue | null {
    return issues.find((issue) => issue.field === field) ?? null;
  }

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    setSchemaIssue(null);

    const payload = {
      // `null` clears a field; an empty string would fail the trimmed minimum.
      bio: bio.trim() === '' ? null : bio.trim(),
      city: city.trim() === '' ? null : city.trim(),
      state: state.trim() === '' ? null : state.trim(),
      budgetTier: budgetTier === '' ? null : budgetTier,
      /*
       * `Number`, not `Number.parseInt`. `parseInt` reads a prefix and discards
       * the rest, which is what silently turned `2.7` into 2; `Number` answers
       * the whole string or `NaN`. Both fields are already blocked above unless
       * they are whole numbers, so this only ever sees one.
       */
      typicalGuestCountMin: guestMin === '' ? null : Number(guestMin),
      typicalGuestCountMax: guestMax === '' ? null : Number(guestMax),
      avatarUrl,
    };

    const parsed = updateUserSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const name = issue?.path[0];

      /*
       * Named, not printed raw. Zod's top-level default is `Invalid input`, and
       * that was the only text a failure produced — above six inputs, of which
       * exactly one was wrong.
       */
      setSchemaIssue(
        isFormField(name) && hasControl(name)
          ? {
              field: `${fieldId}-${FIELD_IDS[name]}`,
              label: FIELD_LABELS[name],
              severity: 'blocker',
              message: issue?.message ?? 'Check this and try again.',
            }
          : null,
      );
      setError(
        isFormField(name)
          ? `${FIELD_LABELS[name]}: ${issue?.message ?? 'Check this and try again.'}`
          : (issue?.message ?? 'Check the fields above.'),
      );
      setSaving(false);
      return;
    }

    try {
      await request('/users/me', { schema: wireUserSchema, method: 'PUT', body: parsed.data });
      setSaved(current);
      toast.success('Profile saved');
    } catch (failure) {
      setError(
        failure instanceof ApiClientError
          ? failure.message
          : 'That did not reach us. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[660px]">
      <div className="mb-5">
        {/* `ImageUpload` draws its own label, so this section adds none. */}
        {/*
          A failed upload leaves the previous photo in place: `onChange` fires
          only on a stored file, so a failure never blanks what was there.
        */}
        <ImageUpload
          label="Profile photo"
          prefix="customer-profile"
          value={avatarUrl}
          onChange={setAvatarUrl}
          rounded
        />
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`${fieldId}-bio`} className={LABEL}>
            About you
          </Label>
          <Textarea
            id={`${fieldId}-bio`}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="We're planning a small outdoor wedding and care most about photos that don't feel posed."
            {...errorProps(issueFor(`${fieldId}-bio`))}
            className={cn(FIELD, 'min-h-24 leading-prose')}
          />
          <FieldMessage issue={issueFor(`${fieldId}-bio`)} />
          <div className="mt-1.25 flex justify-between text-xs text-stone-600">
            <span>Vendors read this when deciding whether to take your date</span>
            <span>
              {bio.trim().length} / {MAX_CUSTOMER_BIO_LENGTH}
            </span>
          </div>
        </div>

        <div>
          <Label htmlFor={`${fieldId}-city`} className={LABEL}>
            City
          </Label>
          {/*
            Capped at the API's own limit so the error is unreachable by typing
            — #72's fifth finding was a bare "Invalid input" at the submit bar,
            reached by pasting 101 characters into a field that accepted them.
            `40-states.md` prefers a blocker the user cannot cross to a message
            explaining that they did.
          */}
          <Input
            id={`${fieldId}-city`}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="Austin"
            maxLength={MAX_NAME_LENGTH}
            {...errorProps(issueFor(`${fieldId}-city`))}
            className={FIELD}
          />
          <FieldMessage issue={issueFor(`${fieldId}-city`)} />
        </div>

        <div>
          <Label htmlFor={`${fieldId}-state`} className={LABEL}>
            State
          </Label>
          <Input
            id={`${fieldId}-state`}
            value={state}
            onChange={(event) => setState(event.target.value)}
            placeholder="TX"
            maxLength={MAX_NAME_LENGTH}
            {...errorProps(issueFor(`${fieldId}-state`))}
            className={FIELD}
          />
          <FieldMessage issue={issueFor(`${fieldId}-state`)} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor={`${fieldId}-budget`} className={LABEL}>
            Typical budget
          </Label>
          {/*
            The glyph never appears without its label and range. `$$$` alone is
            a code the reader has to have been taught; the row spells it out.
          */}
          {/* The one dropdown, not a native `<select>` (#167). */}
          <SingleSelectDropdown
            open={budgetOpen}
            onOpenChange={setBudgetOpen}
            label="Typical budget"
            countNoun="tiers"
            options={[
              { value: '', label: 'Prefer not to say' },
              ...BUDGET_TIERS.map((tier) => ({
                value: tier,
                label: `${BUDGET_TIER_LABELS[tier].glyph} · ${BUDGET_TIER_LABELS[tier].label}`,
                hint: BUDGET_TIER_LABELS[tier].range,
              })),
            ]}
            value={budgetTier}
            onChange={(next) => setBudgetTier(next as BudgetTier | '')}
            trigger={
              <button
                type="button"
                id={`${fieldId}-budget`}
                aria-haspopup="listbox"
                aria-expanded={budgetOpen}
                // A bordered field owns its indicator; see `@/lib/focus`.
                data-focus-own
                className={cn(FIELD, 'flex items-center justify-between gap-2 text-left')}
              >
                <span className={cn('truncate', budgetTier === '' && 'text-stone-600')}>
                  {budgetTier === ''
                    ? 'Prefer not to say'
                    : `${BUDGET_TIER_LABELS[budgetTier].glyph} · ${BUDGET_TIER_LABELS[budgetTier].label} (${BUDGET_TIER_LABELS[budgetTier].range})`}
                </span>
              </button>
            }
          />
        </div>

        <div>
          <Label htmlFor={guestMinId} className={LABEL}>
            Guests, from
          </Label>
          {/*
            `min` and `max` are the spinner's bounds and nothing more — a
            `type="number"` input still hands `2.7` and `1e21` to `onChange`
            unchanged, which is what `guestCountIssue` is for.
          */}
          <Input
            id={guestMinId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_GUEST_COUNT}
            value={guestMin}
            onChange={(event) => setGuestMin(event.target.value)}
            placeholder="50"
            {...errorProps(issueFor(guestMinId))}
            className={FIELD}
          />
          <FieldMessage issue={issueFor(guestMinId)} />
        </div>

        <div>
          <Label htmlFor={guestMaxId} className={LABEL}>
            Guests, up to
          </Label>
          <Input
            id={guestMaxId}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_GUEST_COUNT}
            value={guestMax}
            onChange={(event) => setGuestMax(event.target.value)}
            placeholder="150"
            {...errorProps(issueFor(guestMaxId))}
            className={FIELD}
          />
          <FieldMessage issue={issueFor(guestMaxId)} />
        </div>
      </div>

      {/*
        Every reason a save is refused is named under the control it belongs to,
        above. One of them used to be silent — a decimal or an exponent was not
        refused at all, it was truncated and saved under a `Profile saved`
        toast — and the schema's own refusal named no field, which is what this
        line now does for the whole form.
      */}
      {error ? (
        <p role="alert" className="mt-3 text-xs text-error-500">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        variant="primary"
        onClick={() => void save()}
        disabled={saving || blockers.length > 0}
        className="mt-5"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </Button>

      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}
