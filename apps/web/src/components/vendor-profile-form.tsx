'use client';

import {
  BRAND_DOMAIN,
  createVendorProfileSchema,
  describeBlockers,
  generateSlug,
  kmToMiles,
  MAX_TAGLINE_LENGTH,
  MAX_VENDOR_BIO_LENGTH,
  MAX_YEARS_IN_BUSINESS,
  MIN_YEARS_IN_BUSINESS,
  milesToKm,
  PUBLISH_BLOCKERS,
  RESPONSE_TIME_HOURS_OPTIONS,
  updateVendorProfileSchema,
  UPLOAD_CONSTRAINT_LINE,
  type Category,
  type PublishBlockerKey,
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
import { ImageUpload } from '@/components/image-upload';
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
  responseTime: 'response-time',
  tags: 'tags',
} as const;

/**
 * The storefront's checklist, in the order the frame lists it. `packages` and
 * `portfolio` live on their own surfaces — law 3 keeps packages a master-detail
 * screen — but they are still sections of the same storefront, so they carry
 * their blocker dot here rather than being invisible until the vendor
 * stumbles on them.
 *
 * Payouts is deliberately absent until #9 makes it satisfiable: a nav entry
 * with a dot the vendor can never clear is worse than no entry at all.
 */
const SECTION_ORDER = [
  { key: 'business', label: 'Business', id: SECTION_IDS.business },
  { key: 'location', label: 'Location', id: SECTION_IDS.location },
  { key: 'tags', label: 'Tags', id: SECTION_IDS.tags },
  { key: 'responseTime', label: 'Response time', id: SECTION_IDS.responseTime },
  { key: 'packages', label: 'Packages', id: 'packages', href: '/vendor/packages' },
  { key: 'portfolio', label: 'Portfolio', id: 'portfolio', href: '/vendor/portfolio' },
] as const;

export interface FormState {
  businessName: string;
  slug: string;
  bio: string;
  tagline: string;
  /** Kept as a string: an empty input is "not answered", not zero. */
  yearsInBusiness: string;
  address: string;
  city: string;
  state: string;
  serviceRadiusMiles: number;
  responseTimeHours: string;
  profileImageUrl: string | null;
  categoryIds: string[];
  tagIds: string[];
}

function initialState(profile: WireVendorProfile | null): FormState {
  return {
    businessName: profile?.businessName ?? '',
    slug: profile?.slug ?? '',
    bio: profile?.bio ?? '',
    tagline: profile?.tagline ?? '',
    yearsInBusiness:
      profile?.yearsInBusiness === null || profile?.yearsInBusiness === undefined
        ? ''
        : String(profile.yearsInBusiness),
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
    tagline: form.tagline.trim(),
    // Left blank means "not answered" and is sent as absent; `0` is a real
    // answer and must survive, which `Number('') === 0` would quietly destroy.
    yearsInBusiness: form.yearsInBusiness.trim() === '' ? undefined : Number(form.yearsInBusiness),
    address: form.address.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    serviceRadiusKm: milesToKm(form.serviceRadiusMiles),
    responseTimeHours:
      form.responseTimeHours === NO_RESPONSE_TIME ? undefined : Number(form.responseTimeHours),
    profileImageUrl: form.profileImageUrl ?? undefined,
    categoryIds: form.categoryIds,
  };
}

/**
 * Which blockers the form can still see for itself.
 *
 * The API stays the authority — its list is what survives a reload, and it is
 * the only thing that knows about packages. Recomputing the field-level ones
 * here is what lets a dot clear as the vendor types rather than only after a
 * save round-trip.
 */
export function liveBlockers(form: FormState): PublishBlockerKey[] {
  const blockers: PublishBlockerKey[] = [];

  if (form.businessName.trim() === '') {
    blockers.push('businessName');
  }
  if (form.city.trim() === '' || form.state.trim() === '') {
    blockers.push('location');
  }
  if (form.categoryIds.length === 0) {
    blockers.push('categories');
  }
  if (form.bio.trim() === '') {
    blockers.push('bio');
  }
  if (form.responseTimeHours === NO_RESPONSE_TIME) {
    blockers.push('responseTime');
  }

  return blockers;
}

/**
 * The blockers the vendor should see right now: everything the form can judge
 * live, plus the ones only the server knows about (packages), minus anything
 * the server reported that the vendor has since fixed in the form.
 */
export function mergeBlockers(
  live: readonly PublishBlockerKey[],
  fromServer: readonly PublishBlockerKey[],
): PublishBlockerKey[] {
  const serverOnly = fromServer.filter(
    (key) => !(PUBLISH_BLOCKER_FORM_KEYS as readonly string[]).includes(key),
  );

  return [...live, ...serverOnly];
}

/** The blockers this form owns; the rest can only be resolved server-side. */
const PUBLISH_BLOCKER_FORM_KEYS = [
  'businessName',
  'location',
  'categories',
  'bio',
  'responseTime',
] as const;

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
  const [publishBlockers, setPublishBlockers] = useState<readonly PublishBlockerKey[]>(
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

  const blockers = useMemo(
    () => mergeBlockers(liveBlockers(form), publishBlockers),
    [form, publishBlockers],
  );
  const blockedSections = useMemo<ReadonlySet<string>>(
    () => new Set<string>(blockers.map((key) => PUBLISH_BLOCKERS[key].section)),
    [blockers],
  );

  const responseTimeBlocks = blockers.includes('responseTime');

  const sections: FormSection[] = useMemo(
    () =>
      SECTION_ORDER.map((section) => ({
        id: section.id,
        label: section.label,
        blocks: blockedSections.has(section.key),
        ...('href' in section ? { href: section.href } : {}),
      })),
    [blockedSections],
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
    // The storefront rail replaces the vendor nav on this screen (frame `09`):
    // one 200px rail, and it is the checklist the vendor is working through.
    <div
      data-section-rail
      className="flex min-h-0 flex-col lg:h-full lg:flex-row lg:overflow-hidden"
    >
      <FormSectionNav
        sections={sections}
        className="hidden shrink-0 border-stone-300 bg-stone-0 lg:flex lg:w-(--sidebar-width-sm) lg:border-r"
      />

      <form
        onSubmit={(event) => void save(event)}
        className="flex min-w-0 flex-1 flex-col lg:overflow-hidden"
      >
        <div className="app-pane min-h-0 flex-1 px-4 pt-5.5 sm:px-7">
          <div className="max-w-[65rem]">
            <h1 className="display-heading text-display-md text-stone-900">Your storefront</h1>
            <p className="mt-0.5 mb-4.5 text-base leading-prose text-stone-700">
              This is what a customer sees before they decide to message you.
            </p>
          </div>

          <div className="max-w-[65rem] divide-y divide-stone-200">
            <section id={SECTION_IDS.business} className="scroll-mt-6 pb-6">
              <h2 className="sr-only">Business</h2>

              {/*
               * The profile photo alone. There is no cover drop zone: the
               * cover is a **designation on an existing portfolio tile**, not
               * a second upload of the same image (`40-states.md`). Whatever
               * sits first in the portfolio is the cover, and the portfolio
               * editor says so on the tile.
               */}
              <div className="mt-4 w-24 sm:w-32">
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
              <p className="mt-2 text-xs text-stone-600">{UPLOAD_CONSTRAINT_LINE}</p>

              <div className="field-grid mt-5 border-t border-stone-300 pt-5">
                <div>
                  <Label htmlFor="businessName">Business name</Label>
                  <Input
                    id="businessName"
                    value={form.businessName}
                    onChange={(event) => update('businessName', event.target.value)}
                    required
                    maxLength={200}
                    className="mt-1.5 bg-stone-0"
                  />
                </div>

                <div>
                  <Label htmlFor="slug">Profile link</Label>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(event) => update('slug', event.target.value)}
                    placeholder={generateSlug(form.businessName || 'your-business')}
                    className="mt-1.5 bg-stone-0"
                  />
                  <p className="mt-1 truncate text-xs text-stone-600">
                    {BRAND_DOMAIN}/vendors/{slugPreview}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="tagline">Your line</Label>
                  <Input
                    id="tagline"
                    value={form.tagline}
                    onChange={(event) => update('tagline', event.target.value)}
                    placeholder="Quiet, documentary, never asks you to pose."
                    maxLength={MAX_TAGLINE_LENGTH}
                    className="mt-1.5 bg-stone-0"
                  />
                  <div className="mt-1 flex items-baseline justify-between gap-3 text-xs">
                    <p className="text-stone-600">
                      One sentence, in your own words. It opens your profile.
                    </p>
                    <p className="shrink-0 tabular-nums text-stone-600">
                      {form.tagline.length} / {MAX_TAGLINE_LENGTH}
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="yearsInBusiness">Years in business</Label>
                  <Input
                    id="yearsInBusiness"
                    type="number"
                    inputMode="numeric"
                    min={MIN_YEARS_IN_BUSINESS}
                    max={MAX_YEARS_IN_BUSINESS}
                    value={form.yearsInBusiness}
                    onChange={(event) => update('yearsInBusiness', event.target.value)}
                    placeholder="10"
                    className="mt-1.5 bg-stone-0"
                  />
                  <p className="mt-1 text-xs text-stone-600">
                    Counted from when you started, not when you joined here.
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
                    className="mt-1.5 min-h-[140px] bg-stone-0"
                  />
                  <div className="mt-1 flex items-baseline justify-between gap-3 text-xs">
                    <p className="text-stone-600">A couple of paragraphs is plenty.</p>
                    <p
                      // Warns before the cap rather than only on reaching it, so a
                      // vendor can finish the sentence instead of being cut off.
                      className={cn(
                        'shrink-0 tabular-nums',
                        bioRemaining <= BIO_WARNING_THRESHOLD ? 'text-clay-600' : 'text-stone-600',
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
            <section id={SECTION_IDS.location} className="scroll-mt-6 py-6">
              <h2 className="sr-only">Location &amp; service area</h2>

              <div className="field-grid mt-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(event) => update('address', event.target.value)}
                    className="mt-1.5 bg-stone-0"
                  />
                </div>

                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(event) => update('city', event.target.value)}
                    required
                    className="mt-1.5 bg-stone-0"
                  />
                </div>

                <div>
                  <Label htmlFor="state">State</Label>
                  <Select value={form.state} onValueChange={(value) => update('state', value)}>
                    <SelectTrigger
                      id="state"
                      className="mt-1.5 w-full bg-stone-0 data-[size=default]:h-11 sm:data-[size=default]:h-[38px]"
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
                    className="mt-3 h-6 w-full accent-clay-400"
                  />
                  <p className="mt-1 text-xs text-stone-600">
                    How far you will travel for an event.
                  </p>
                </div>

                {/*
                  The first of the three places a publish blocker shows at
                  once. The gold border and gold helper are the blocking-field
                  variant in design/design-plan/03-components.md — the same gold
                  the nav dot and the submit bar carry, so all three read as one
                  thing rather than three warnings.
                */}
                <div id={SECTION_IDS.responseTime} className="scroll-mt-6">
                  <Label htmlFor="responseTime">Typical response time</Label>
                  <Select
                    value={form.responseTimeHours}
                    onValueChange={(value) => update('responseTimeHours', value)}
                  >
                    <SelectTrigger
                      id="responseTime"
                      aria-describedby="responseTime-help"
                      className={cn(
                        'mt-1.5 w-full bg-stone-0 data-[size=default]:h-11 sm:data-[size=default]:h-[38px]',
                        responseTimeBlocks && 'border-gold-400',
                      )}
                    >
                      <SelectValue placeholder="Choose one" />
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
                  <p
                    id="responseTime-help"
                    className={cn(
                      'mt-1.5 text-xs',
                      responseTimeBlocks ? 'text-gold-600' : 'text-stone-600',
                    )}
                  >
                    {responseTimeBlocks
                      ? 'Required before you can publish'
                      : 'How quickly customers can expect to hear back.'}
                  </p>
                </div>
              </div>
            </section>

            <section id={SECTION_IDS.tags} className="scroll-mt-6 py-6">
              {/*
               * Visually hidden, like the Business and Location headings above.
               * Frame `09`'s form pane carries exactly one visible heading —
               * `Your storefront` — and no section headings under it; the
               * section names live in the nav rail instead. The heading stays
               * in the accessibility tree because the nav's anchors target
               * these sections, and a landmark a screen reader cannot name is
               * a worse trade than a heading a sighted vendor never sees.
               */}
              <h2 className="sr-only">Tags</h2>
              <p className="mt-1 text-base leading-prose text-stone-700">
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
        </div>

        {/*
         * The bar is the pane's floor rather than a block after the last field:
         * the primary action, the save state, and what is holding publication
         * back all stay on screen while the vendor works down the form.
         */}
        {/*
          The pane's floor at `lg`, where the shell owns the viewport. Below it
          the page scrolls normally, so the bar sticks instead — the primary
          action stays reachable at every width (30-responsive.md).
        */}
        <div className="sticky bottom-0 z-(--z-sticky) shrink-0 border-t border-stone-300 bg-stone-0 px-4 py-3.5 sm:px-7 lg:static">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {isNew ? (
              <p className="text-base text-stone-700">
                You can change any of this after you create your profile.
              </p>
            ) : blockers.length > 0 ? (
              /*
               * The third of the three places a blocker appears at once — the
               * field, the nav, and here — so the vendor sees what and where
               * without scrolling to find either.
               */
              <p className="flex items-center gap-2.5 text-base text-stone-700">
                <span aria-hidden="true" className="size-1.75 shrink-0 rounded-full bg-gold-400" />
                <span>
                  <strong className="font-semibold">
                    {blockers.length} thing{blockers.length === 1 ? '' : 's'}
                  </strong>{' '}
                  left before you can publish — {describeBlockers(blockers)}
                </span>
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <Switch
                  id="isPublished"
                  className={SWITCH_TOUCH_TARGET}
                  checked={isPublished}
                  disabled={isSaving}
                  onCheckedChange={(next) => void togglePublished(next)}
                />
                <div>
                  <Label htmlFor="isPublished">Visible to customers</Label>
                  <p className="text-xs text-stone-600">
                    {isPublished
                      ? 'Customers can find and book you.'
                      : 'Ready to publish — flip this when you are.'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3.5">
              <span aria-live="polite" className="text-sm text-stone-600">
                {isSaving ? 'Saving…' : justSaved ? 'Saved' : isDirty ? 'Unsaved changes' : ''}
              </span>
              {profile !== null ? (
                <Button type="button" variant="secondary" asChild>
                  <a href={`/vendors/${profile.slug}`}>Preview</a>
                </Button>
              ) : null}
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isNew ? 'Create profile' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
