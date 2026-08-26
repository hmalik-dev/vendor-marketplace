'use client';

import {
  createVendorProfileSchema,
  generateSlug,
  RESPONSE_TIME_HOURS_OPTIONS,
  updateVendorProfileSchema,
  type Category,
} from '@vendorhub/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { useApi } from '@/lib/use-api';
import { US_STATES } from '@/lib/us-states';
import {
  wireTagListSchema,
  wireVendorProfileSchema,
  type WireTag,
  type WireVendorProfile,
} from '@/lib/wire-schemas';
import { CategoryPicker } from '@/components/category-picker';
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
import { Switch } from '@/components/ui/switch';
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
const SERVICE_RADIUS_MIN = 10;
const SERVICE_RADIUS_MAX = 200;
const DEFAULT_SERVICE_RADIUS_KM = 50;

interface FormState {
  businessName: string;
  slug: string;
  bio: string;
  address: string;
  city: string;
  state: string;
  serviceRadiusKm: number;
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
    serviceRadiusKm: profile?.serviceRadiusKm ?? DEFAULT_SERVICE_RADIUS_KM,
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
    serviceRadiusKm: form.serviceRadiusKm,
    responseTimeHours:
      form.responseTimeHours === NO_RESPONSE_TIME ? undefined : Number(form.responseTimeHours),
    profileImageUrl: form.profileImageUrl ?? undefined,
    coverImageUrl: form.coverImageUrl ?? undefined,
    categoryIds: form.categoryIds,
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
  const [isSaving, setIsSaving] = useState(false);
  const [publishBlockers, setPublishBlockers] = useState<readonly string[]>(
    profile?.publishBlockers ?? [],
  );
  const [isPublished, setIsPublished] = useState(profile?.isPublished ?? false);

  const isNew = profile === null;
  const slugPreview = form.slug.trim() || generateSlug(form.businessName || 'your-business');

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
      setForm((previous) => ({
        ...previous,
        slug: saved.slug,
        tagIds: savedTags.map((tag) => tag.id),
      }));

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
    <form onSubmit={(event) => void save(event)} className="space-y-8">
      <section className="rounded-lg border border-stone-150 bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-semibold text-stone-800">Photos</h2>
        <p className="mt-1 text-sm text-stone-600">
          A cover image and a profile photo customers will recognise you by.
        </p>
        <div className="mt-4 space-y-4">
          <ImageUpload
            label="Cover image"
            prefix="vendor-cover"
            value={form.coverImageUrl}
            onChange={(url) => update('coverImageUrl', url)}
            disabled={isSaving}
          />
          <ImageUpload
            label="Profile photo"
            prefix="vendor-profile"
            value={form.profileImageUrl}
            onChange={(url) => update('profileImageUrl', url)}
            rounded
            disabled={isSaving}
          />
        </div>
      </section>

      <section className="rounded-lg border border-stone-150 bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-semibold text-stone-800">Business information</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              value={form.businessName}
              onChange={(event) => update('businessName', event.target.value)}
              required
              maxLength={200}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="slug">Profile link</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(event) => update('slug', event.target.value)}
              placeholder={generateSlug(form.businessName || 'your-business')}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-stone-500">vendorhub.com/vendors/{slugPreview}</p>
          </div>

          <div>
            <Label htmlFor="bio">About your business</Label>
            <Textarea
              id="bio"
              value={form.bio}
              onChange={(event) => update('bio', event.target.value)}
              rows={5}
              placeholder="What you do, who you do it for, and what makes a day with you feel different."
              className="mt-1"
            />
            <p className="mt-1 text-xs text-stone-500">
              A couple of paragraphs is plenty. {form.bio.trim().length} characters so far.
            </p>
          </div>

          <div>
            <Label htmlFor="categories">Categories</Label>
            <div id="categories" className="mt-1">
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

      <section className="rounded-lg border border-stone-150 bg-card p-5 shadow-sm sm:p-6">
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

      <section className="rounded-lg border border-stone-150 bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-semibold text-stone-800">Location & service area</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(event) => update('address', event.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Select value={form.state} onValueChange={(value) => update('state', value)}>
                <SelectTrigger
                id="state"
                className="mt-1 w-full data-[size=default]:h-11 sm:data-[size=default]:h-8"
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
          </div>

          <div>
            <Label htmlFor="serviceRadius">
              Service radius: {form.serviceRadiusKm} km
            </Label>
            <input
              id="serviceRadius"
              type="range"
              min={SERVICE_RADIUS_MIN}
              max={SERVICE_RADIUS_MAX}
              step={5}
              value={form.serviceRadiusKm}
              onChange={(event) => update('serviceRadiusKm', Number(event.target.value))}
              className="mt-2 h-11 w-full accent-primary-400"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-stone-150 bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-semibold text-stone-800">Response time</h2>
        <div className="mt-4">
          <Label htmlFor="responseTime">Expected response time</Label>
          <Select
            value={form.responseTimeHours}
            onValueChange={(value) => update('responseTimeHours', value)}
          >
            <SelectTrigger
              id="responseTime"
              className="mt-1 w-full data-[size=default]:h-11 sm:w-72 sm:data-[size=default]:h-8"
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
        </div>
      </section>

      {!isNew ? (
        <section className="rounded-lg border border-stone-150 bg-card p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-lg font-semibold text-stone-800">Visibility</h2>
          <div className="mt-4 flex items-start gap-3">
            <Switch
              id="isPublished"
              // Keeps the switch its designed size while giving touch a 44px
              // target, as the viewport checklist requires.
              className="relative after:absolute after:-inset-3.5 after:content-[''] sm:after:hidden"
              checked={isPublished}
              disabled={isSaving || (!isPublished && publishBlockers.length > 0)}
              onCheckedChange={(next) => void togglePublished(next)}
            />
            <div>
              <Label htmlFor="isPublished">Profile visible to customers</Label>
              <p className="mt-1 text-sm text-stone-600">
                {isPublished
                  ? 'Customers can find and book you.'
                  : 'Only you can see this profile right now.'}
              </p>
            </div>
          </div>

          {publishBlockers.length > 0 ? (
            <div className="mt-4 rounded-md bg-gold-100 p-4">
              <p className="text-sm font-medium text-stone-800">
                Complete these steps before publishing:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
                {publishBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" variant="cta" size="cta" disabled={isSaving}>
          {isSaving ? 'Saving…' : isNew ? 'Create profile' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
