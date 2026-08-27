'use client';

import {
  createVendorProfileSchema,
  generateSlug,
  kmToMiles,
  MAX_VENDOR_BIO_LENGTH,
  milesToKm,
  RESPONSE_TIME_HOURS_OPTIONS,
  updateVendorProfileSchema,
  type Category,
} from '@vendor-marketplace/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/utils';
import { US_STATES } from '@/lib/us-states';
import {
  wireTagListSchema,
  wireVendorProfileSchema,
  type WireTag,
  type WireVendorProfile,
} from '@/lib/wire-schemas';
import { CategoryPicker } from '@/components/category-picker';
import { FormSectionNav, type FormSection } from '@/components/form-section-nav';
import { ImageUpload, MAX_UPLOAD_MB } from '@/components/image-upload';
import { TagPicker } from '@/components/tags/tag-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch, SWITCH_TOUCH_TARGET } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export interface VendorProfileFormProps {
  /** `null` while the vendor is still onboarding. */
  profile: WireVendorProfile | null;
  categories: readonly Category[];
  allTags: readonly WireTag[];
}

const RESPONSE_TIME_LABELS: Record<number, string> = {
  1: 'Within 1 hour',
  4: 'Within 4 hours',
  24: 'Within 24 hours',
  48: 'Within 48 hours',
};

const NO_RESPONSE_TIME = 'unset';

/** Radius is chosen in miles; kilometres are only ever the storage unit. */
const SERVICE_RADIUS_MIN_MILES = 5;
const SERVICE_RADIUS_MAX_MILES = 125;
const SERVICE_RADIUS_STEP_MILES = 5;
const DEFAULT_SERVICE_RADIUS_MILES = 30;

/** How long the inline "Saved" confirmation stays up. */
const SAVED_NOTICE_MS = 2000;

/** Characters left before the bio counter starts warning. */
const BIO_WARNING_THRESHOLD = 100;

const SECTION_IDS = {
  business: 'business-information',
  location: 'location-service-area',
  tags: 'tags',
} as const;

interface FormState {
  businessName: string;
  slug: string;
  bio: string;
  address: string;
  city: string;
  state: string;
  serviceRadiusMiles: number;
  responseTimeHours: string;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  categoryIds: string[];
  tagIds: string[];
}

function initialState(profile: WireVendorProfile | null): FormState {
  return {
    businessName: profile?.businessName ?? '',
    slug: profile?.slug ?? '',
    bio: profile?.bio ?? '',
    address: profile?.address ?? '',
    city: profile?.city ?? '',
    state: profile?.state ?? '',
    serviceRadiusMiles:
      profile?.serviceRadiusKm === null || profile?.serviceRadiusKm === undefined
        ? DEFAULT_SERVICE_RADIUS_MILES
        : kmToMiles(profile.serviceRadiusKm),
    responseTimeHours:
      profile?.responseTimeHours === null || profile?.responseTimeHours === undefined
        ? NO_RESPONSE_TIME
        : String(profile.responseTimeHours),
    profileImageUrl: profile?.profileImageUrl ?? null,
    coverImageUrl: profile?.coverImageUrl ?? null,
    categoryIds: [...(profile?.categoryIds ?? [])],
    tagIds: (profile?.tags ?? []).map((tag) => tag.id),
  };
}

/**
 * Fields shared by the create and update payloads.
 *
 * The free-text optional fields are sent even when empty: an update only
 * touches the keys it carries, so collapsing `''` to `undefined` would leave a
 * vendor unable to clear a bio or an address once set. `slug` and the image
 * URLs are the exception — their schemas reject `''`, and an omitted slug is
 * how the caller asks the service to derive one.
 */
function toPayload(form: FormState): Record<string, unknown> {
  return {
    businessName: form.businessName.trim(),
    slug: form.slug.trim() === '' ? undefined : form.slug.trim(),
    bio: form.bio.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    serviceRadiusKm: milesToKm(form.serviceRadiusMiles),
    responseTimeHours:
      form.responseTimeHours === NO_RESPONSE_TIME ? undefined : Number(form.responseTimeHours),
    profileImageUrl: form.profileImageUrl ?? undefined,
    coverImageUrl: form.coverImageUrl ?? undefined,
    categoryIds: form.categoryIds,
  };
}

/**
 * Which sections still hold something back from publishing.
 *
 * These mirror `publishBlockers` in the API, which stays the authority — the
 * server's list is what the submit bar prints. Recomputing them from form state
 * is what lets the nav's dots clear as the vendor types, rather than only after
 * a save round-trip.
 */
function blockingSections(form: FormState): Record<keyof typeof SECTION_IDS, boolean> {
  return {
    business:
      form.businessName.trim() === '' || form.bio.trim() === '' || form.categoryIds.length === 0,
    location: form.city.trim() === '' || form.state.trim() === '',
    tags: false,
  };
}

/**
 * The vendor's business profile, used for both first-time onboarding and later
 * edits. Saving is explicit rather than autosaved: a half-typed business name
 * would otherwise be published to a live profile.
 *
 * Tags are saved through their own endpoint because they are a separate
 * many-to-many replace, but the vendor sees one "Save" — so the profile write
 * lands first, and the tag write is only attempted once the profile exists.
 */
export function VendorProfileForm({
  profile,
  categories,
  allTags,
}: VendorProfileFormProps): React.ReactElement {
  const request = useApi();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(profile));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialState(profile)));
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [publishBlockers, setPublishBlockers] = useState<readonly string[]>(
    profile?.publishBlockers ?? [],
  );
  const [isPublished, setIsPublished] = useState(profile?.isPublished ?? false);

  const isNew = profile === null;
  const slugPreview = form.slug.trim() || generateSlug(form.businessName || 'your-business');
  const isDirty = JSON.stringify(form) !== savedSnapshot;
  const bioRemaining = MAX_VENDOR_BIO_LENGTH - form.bio.length;

  useEffect(() => {
    if (!justSaved) {
      return;
    }

    const timer = setTimeout(() => setJustSaved(false), SAVED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const blocking = blockingSections(form);
  const sections: FormSection[] = useMemo(
    () => [
      { id: SECTION_IDS.business, label: 'Business information', blocks: blocking.business },
      { id: SECTION_IDS.location, label: 'Location & service area', blocks: blocking.location },
      { id: SECTION_IDS.tags, label: 'Tags', blocks: blocking.tags },
    ],
    [blocking.business, blocking.location, blocking.tags],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const payload = toPayload(form);
    const schema = isNew ? createVendorProfileSchema : updateVendorProfileSchema;
    const parsed = schema.safeParse(payload);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Check the highlighted fields.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await request('/vendor/profile', {
        method: isNew ? 'POST' : 'PUT',
        body: parsed.data,
        schema: wireVendorProfileSchema,
      });

      const savedTags = await request('/vendor/tags', {
        method: 'PUT',
        body: { tagIds: form.tagIds },
        // The wire variant: `tagSchema.createdAt` is a `Date`, and JSON carries
        // an ISO string.
        schema: wireTagListSchema,
      });

      setPublishBlockers(saved.publishBlockers);
      setIsPublished(saved.isPublished);
      setForm((previous) => {
        const next = {
          ...previous,
          slug: saved.slug,
          tagIds: savedTags.map((tag) => tag.id),
        };
        setSavedSnapshot(JSON.stringify(next));
        return next;
      });

      setJustSaved(true);
      toast.success(isNew ? 'Profile created.' : 'Changes saved.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublished = async (next: boolean): Promise<void> => {
    setIsSaving(true);
    try {
      const saved = await request('/vendor/profile', {
        method: 'PUT',
        body: { isPublished: next },
        schema: wireVendorProfileSchema,
      });

      setIsPublished(saved.isPublished);
      setPublishBlockers(saved.publishBlockers);
      toast.success(saved.isPublished ? 'Your profile is live.' : 'Your profile is hidden.');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'Could not change your visibility.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="xl:grid xl:grid-cols-[var(--section-nav-width)_1fr] xl:items-start xl:gap-8">
      <FormSectionNav sections={sections} className="sticky top-24 hidden xl:block" />

      <form onSubmit={(event) => void save(event)} className="min-w-0">
        <div className="divide-y divide-stone-150 rounded-lg border border-stone-150 bg-card shadow-sm">
          <section id={SECTION_IDS.business} className="scroll-mt-24 p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-stone-800">
              Business information
            </h2>

            {/*
             * The photo and the cover describe one thing — the vendor's visual
             * identity — so they sit on one row, identity first. A full-width
             * cover above a lone circle reads as an orphaned row.
             */}
            <div className="mt-4 flex items-start gap-4 sm:gap-5">
              {/* Fixed to the circle's width: left to size itself, the column
                stretches to its longest text and starves the cover beside it. */}
              <div className="w-24 shrink-0 sm:w-40">
                <ImageUpload
                  label="Profile photo"
                  prefix="vendor-profile"
                  value={form.profileImageUrl}
                  onChange={(url) => update('profileImageUrl', url)}
                  rounded
                  showHint={false}
                  disabled={isSaving}
                />
              </div>
              <div className="min-w-0 flex-1">
                <ImageUpload
                  label="Cover image"
                  prefix="vendor-cover"
                  value={form.coverImageUrl}
                  onChange={(url) => update('coverImageUrl', url)}
                  // Height-matched to the profile circle rather than an aspect
                  // ratio: the two are a pair, and an aspect-ratio drop zone
                  // grows taller every time the pane gets wider.
                  aspectClassName="h-24 sm:h-40"
                  showHint={false}
                  disabled={isSaving}
                />
              </div>
            </div>
            {/* One hint for the pair — the same rule governs both uploads. */}
            <p className="mt-2 text-xs text-stone-500">
              JPEG, PNG, or WebP, up to {MAX_UPLOAD_MB}MB.
            </p>

            <div className="field-grid mt-5 border-t border-stone-150 pt-5">
              <div>
                <Label htmlFor="businessName">Business name</Label>
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={(event) => update('businessName', event.target.value)}
                  required
                  maxLength={200}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="slug">Profile link</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(event) => update('slug', event.target.value)}
                  placeholder={generateSlug(form.businessName || 'your-business')}
                  className="mt-1.5"
                />
                <p className="mt-1 truncate text-xs text-stone-500">
                  venmatch.com/vendors/{slugPreview}
                </p>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="bio">About your business</Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  onChange={(event) => update('bio', event.target.value)}
                  placeholder="What you do, who you do it for, and what makes a day with you feel different."
                  maxLength={MAX_VENDOR_BIO_LENGTH}
                  className="mt-1.5 min-h-[140px]"
                />
                <div className="mt-1 flex items-baseline justify-between gap-3 text-xs">
                  <p className="text-stone-500">A couple of paragraphs is plenty.</p>
                  <p
                    // Warns before the cap rather than only on reaching it, so a
                    // vendor can finish the sentence instead of being cut off.
                    className={cn(
                      'shrink-0 tabular-nums',
                      bioRemaining <= BIO_WARNING_THRESHOLD ? 'text-primary-600' : 'text-stone-400',
                    )}
                  >
                    {form.bio.length} / {MAX_VENDOR_BIO_LENGTH}
                  </p>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="categories">Categories</Label>
                <div id="categories" className="mt-1.5">
                  <CategoryPicker
                    categories={categories}
                    selectedCategoryIds={form.categoryIds}
                    onChange={(ids) => update('categoryIds', ids)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
          </section>

          {/*
           * Location comes before tags: where a vendor works decides whether a
           * customer ever sees them, which is a more consequential answer than a
           * taste tag.
           */}
          <section id={SECTION_IDS.location} className="scroll-mt-24 p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-stone-800">
              Location &amp; service area
            </h2>

            <div className="field-grid mt-4">
              <div className="sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(event) => update('address', event.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(event) => update('city', event.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="state">State</Label>
                <Select value={form.state} onValueChange={(value) => update('state', value)}>
                  <SelectTrigger
                    id="state"
                    className="mt-1.5 w-full data-[size=default]:h-11 sm:data-[size=default]:h-9"
                  >
                    <SelectValue placeholder="Choose a state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="serviceRadius">Service radius</Label>
                  <span className="text-sm font-medium text-stone-700">
                    {form.serviceRadiusMiles} miles
                  </span>
                </div>
                <input
                  id="serviceRadius"
                  type="range"
                  min={SERVICE_RADIUS_MIN_MILES}
                  max={SERVICE_RADIUS_MAX_MILES}
                  step={SERVICE_RADIUS_STEP_MILES}
                  value={form.serviceRadiusMiles}
                  onChange={(event) => update('serviceRadiusMiles', Number(event.target.value))}
                  className="mt-3 h-6 w-full accent-primary-400"
                />
                <p className="mt-1 text-xs text-stone-500">How far you will travel for an event.</p>
              </div>

              {/* One select does not deserve a card of its own. */}
              <div>
                <Label htmlFor="responseTime">Response time</Label>
                <Select
                  value={form.responseTimeHours}
                  onValueChange={(value) => update('responseTimeHours', value)}
                >
                  <SelectTrigger
                    id="responseTime"
                    className="mt-1.5 w-full data-[size=default]:h-11 sm:data-[size=default]:h-9"
                  >
                    <SelectValue placeholder="Choose a response window" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_RESPONSE_TIME}>Not specified</SelectItem>
                    {RESPONSE_TIME_HOURS_OPTIONS.map((hours) => (
                      <SelectItem key={hours} value={String(hours)}>
                        {RESPONSE_TIME_LABELS[hours]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-stone-500">
                  How quickly customers can expect to hear back.
                </p>
              </div>
            </div>
          </section>

          <section id={SECTION_IDS.tags} className="scroll-mt-24 p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-stone-800">Tags</h2>
            <p className="mt-1 text-sm text-stone-600">
              How customers find someone who fits their celebration.
            </p>
            <div className="mt-4">
              <TagPicker
                allTags={allTags}
                selectedTagIds={form.tagIds}
                onTagsChange={(ids) => update('tagIds', ids)}
                disabled={isSaving}
              />
            </div>
          </section>
        </div>

        {/*
         * Sticky rather than parked after the last field: the primary action,
         * the save state, and what is blocking publication stay reachable
         * without scrolling back down.
         */}
        <div className="sticky bottom-0 z-(--z-sticky) mt-4 rounded-lg border border-stone-150 bg-stone-50/95 px-4 py-3 shadow-lg backdrop-blur sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {isNew ? (
              <p className="text-sm text-stone-600">
                You can change any of this after you create your profile.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <Switch
                  id="isPublished"
                  className={SWITCH_TOUCH_TARGET}
                  checked={isPublished}
                  disabled={isSaving || (!isPublished && publishBlockers.length > 0)}
                  onCheckedChange={(next) => void togglePublished(next)}
                />
                <div>
                  <Label htmlFor="isPublished">Visible to customers</Label>
                  <p className="text-xs text-stone-600">
                    {isPublished
                      ? 'Customers can find and book you.'
                      : publishBlockers.length > 0
                        ? `${publishBlockers.length} thing${publishBlockers.length === 1 ? '' : 's'} left: ${publishBlockers.join(' · ')}`
                        : 'Only you can see this profile right now.'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span aria-live="polite" className="text-sm text-stone-500">
                {isSaving ? 'Saving…' : justSaved ? 'Saved' : isDirty ? 'Unsaved changes' : ''}
              </span>
              <Button type="submit" variant="cta" size="cta" disabled={isSaving}>
                {isNew ? 'Create profile' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
