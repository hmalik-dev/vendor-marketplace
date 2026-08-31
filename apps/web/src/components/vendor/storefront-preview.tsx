'use client';

import { useState } from 'react';
import type { VendorCard as VendorCardData } from '@vendor-marketplace/shared';
import { Avatar } from '@/components/ui/avatar';
import { VendorCard } from '@/components/vendors/vendor-card';
import { cn } from '@/lib/utils';

/** Which placement of the one cover photo the rail is showing. */
type Placement = 'search' | 'profile';

export interface StorefrontPreviewProps {
  vendor: VendorCardData;
  className?: string;
}

const TABS: ReadonlyArray<{ key: Placement; label: string }> = [
  { key: 'search', label: 'In search' },
  { key: 'profile', label: 'Your profile' },
];

/**
 * The storefront's mirror, on its own surface beside the form.
 *
 * It is deliberately **not a field**. Frame `09`'s note is explicit — "It stays
 * a separate surface at every width; it never becomes a field" — which is what
 * the old in-form card got wrong: sitting in the field row, it asserted a
 * business name directly above the input where that name is typed.
 *
 * The toggle exists because one uploaded file lands in two places (#287), and a
 * vendor who cannot name an aspect ratio can still judge whether the card looks
 * right in both.
 *
 * See design/design-plan/17-vendor-profile-editor.md.
 */
export function StorefrontPreview({
  vendor,
  className,
}: StorefrontPreviewProps): React.ReactElement {
  const [placement, setPlacement] = useState<Placement>('search');

  return (
    <aside
      aria-label="Storefront preview"
      data-storefront-preview
      className={cn(
        'flex shrink-0 flex-col gap-3.5 bg-stone-100 p-5.5 lg:border-l lg:border-stone-300',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[0.625rem] font-medium tracking-[0.14em] text-stone-600 uppercase">
          Preview
        </span>
        <span className="text-helper text-stone-600">Updates as you type</span>
      </div>

      {/*
        A two-option switch, so `radiogroup` rather than tabs: there is no
        tabbed content to own, only which placement the one card is drawn in.
      */}
      <div role="radiogroup" aria-label="Preview placement" className="flex gap-1">
        {TABS.map((tab) => {
          const isActive = tab.key === placement;

          return (
            <button
              key={tab.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setPlacement(tab.key)}
              className={cn(
                'flex-1 rounded-[7px] py-1.5 text-center text-action transition-colors duration-(--duration-fast)',
                isActive
                  ? 'bg-stone-0 font-semibold text-stone-900 shadow-[0_1px_3px_rgba(35,32,28,.08)]'
                  : 'font-medium text-stone-600 hover:text-stone-900',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/*
        The acceptance line is "no link out": `VendorCard` wraps its body in a
        Link to the public profile, and a vendor clicking their own preview
        would be navigated off a form holding unsaved edits.

        It is the real card rather than a rebuilt one on purpose — a preview
        that drifts from the thing it previews is worse than no preview. Frame
        `09` draws this card as static spans, not as a link.

        `preview` rather than the `inert` wrapper this replaced (#358). The
        wrapper worked, but it stated the constraint at the wrong end: the card
        is the thing that knows it is "ONE control", so the exception belongs
        on the card. `inert` also removed the subtree from the accessibility
        tree, which was defensible — it is a second rendering of content the
        vendor is editing in labelled fields alongside — but it was a side
        effect of the workaround rather than a decision, and the prop leaves
        that judgement where it can be made deliberately.
      */}
      {placement === 'search' ? (
        <VendorCard vendor={vendor} preview />
      ) : (
        <ProfilePlacement vendor={vendor} />
      )}

      <p className="text-helper leading-relaxed text-stone-600">
        {placement === 'search'
          ? 'This is the card a customer taps. The same photo heads your profile — switch tabs to see it.'
          : 'This is how the photo heads your profile page.'}
      </p>
    </aside>
  );
}

/**
 * The cover in its other placement: the band that heads the public profile,
 * with the avatar breaking the seam.
 *
 * Frame `09` draws only the `In search` state, so this is the frame `03`
 * header reduced to what the toggle is actually about — the one photograph in
 * its second position. It is not the profile header component: reproducing a
 * whole page header inside a 260px rail would show less, not more.
 */
function ProfilePlacement({ vendor }: { vendor: VendorCardData }): React.ReactElement {
  return (
    <div inert className="overflow-hidden rounded-[14px] border border-stone-300 bg-stone-0">
      {/*
        The coverless ground is `stone-250` and nothing else — D18, and the
        same block #357 gave the card and the profile header. A hatch is a
        build-time device and `40-states.md` marks it "never on a public page";
        this preview is showing the vendor what a customer will see.
      */}
      <div className="aspect-3/2 overflow-hidden bg-stone-250">
        {vendor.coverImageUrl === null ? null : (
          // The vendor's own upload, from a bucket next/image has no per-host
          // configuration for.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={vendor.coverImageUrl} alt="" className="size-full object-cover" />
        )}
      </div>
      <div className="px-3.5 pb-3.5">
        {/*
          The shared Avatar rather than a hand-rolled circle: it owns the
          fallback tones, the initials, and the serif glyph sizing that keeps
          Instrument Serif above its 16px floor. Ringed because it is cut out
          of the cover above it.
        */}
        <Avatar
          name={vendor.businessName}
          src={vendor.profileImageUrl}
          size="row"
          ring="card"
          className="-mt-4 mb-2"
        />
        <p className="font-display text-lg text-stone-900">{vendor.businessName}</p>
      </div>
    </div>
  );
}
