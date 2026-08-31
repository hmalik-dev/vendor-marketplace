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
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/image-upload';
import { Button } from '@/components/ui/button';
import { SingleSelectDropdown } from '@/components/ui/dropdown-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { wireUserSchema, type WireUser } from '@/lib/wire-schemas';
import { cn } from '@/lib/utils';

export interface CustomerProfileFormProps {
  user: WireUser;
}

const FIELD =
  'h-auto w-full rounded-[10px] border border-stone-300 bg-stone-150 px-3.25 py-2.5 text-base text-stone-900 focus-visible:border-clay-400 focus-visible:ring-3 focus-visible:ring-clay-400/15';

const LABEL = 'mb-1.5 text-label font-semibold tracking-label text-stone-600 uppercase';

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

  const guestRangeInverted =
    guestMin !== '' && guestMax !== '' && Number(guestMin) > Number(guestMax);

  async function save(): Promise<void> {
    setSaving(true);
    setError(null);

    const payload = {
      // `null` clears a field; an empty string would fail the trimmed minimum.
      bio: bio.trim() === '' ? null : bio.trim(),
      city: city.trim() === '' ? null : city.trim(),
      state: state.trim() === '' ? null : state.trim(),
      budgetTier: budgetTier === '' ? null : budgetTier,
      typicalGuestCountMin: guestMin === '' ? null : Number.parseInt(guestMin, 10),
      typicalGuestCountMax: guestMax === '' ? null : Number.parseInt(guestMax, 10),
      avatarUrl,
    };

    const parsed = updateUserSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the fields above.');
      setSaving(false);
      return;
    }

    try {
      await request('/users/me', { schema: wireUserSchema, method: 'PUT', body: parsed.data });
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
            className={cn(FIELD, 'min-h-24 leading-prose')}
          />
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
            className={FIELD}
          />
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
            className={FIELD}
          />
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
          <Label htmlFor={`${fieldId}-guest-min`} className={LABEL}>
            Guests, from
          </Label>
          <Input
            id={`${fieldId}-guest-min`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_GUEST_COUNT}
            value={guestMin}
            onChange={(event) => setGuestMin(event.target.value)}
            placeholder="50"
            aria-invalid={guestRangeInverted}
            className={cn(FIELD, guestRangeInverted && 'border-[1.5px] border-error-500')}
          />
        </div>

        <div>
          <Label htmlFor={`${fieldId}-guest-max`} className={LABEL}>
            Guests, up to
          </Label>
          <Input
            id={`${fieldId}-guest-max`}
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_GUEST_COUNT}
            value={guestMax}
            onChange={(event) => setGuestMax(event.target.value)}
            placeholder="150"
            className={FIELD}
          />
        </div>
      </div>

      {guestRangeInverted ? (
        <p className="mt-3 text-xs text-error-500">
          The smaller number goes first — swap them and this will save.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-xs text-error-500">{error}</p> : null}

      <Button
        type="button"
        variant="primary"
        onClick={() => void save()}
        disabled={saving || guestRangeInverted}
        className="mt-5"
      >
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}
