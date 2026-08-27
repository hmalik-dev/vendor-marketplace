'use client';

import { useState } from 'react';
import { SignUp } from '@clerk/nextjs';
import type { UserRole } from '@vendor-marketplace/shared';
import { AuthScreen } from '@/components/auth/auth-screen';
import { cn } from '@/lib/utils';

export type SignUpRole = Extract<UserRole, 'customer' | 'vendor'>;

interface RoleChoice {
  role: SignUpRole;
  title: string;
  description: string;
  /**
   * The muted geometric glyph in the card's circle. A square for planning an
   * event, a circle for offering a service — abstract on purpose, because
   * neither side is an icon a first-time visitor would already recognise.
   */
  glyph: 'square' | 'circle';
  /**
   * The selected card's accent, matched to the marketing panel beside it: clay
   * for the customer, sage for the vendor. Sage is the settled, working-side
   * colour throughout the product, so the vendor path is coloured the way the
   * vendor's own surfaces are.
   */
  selectedCard: string;
  selectedGlyph: string;
}

const ROLE_CHOICES: readonly RoleChoice[] = [
  {
    role: 'customer',
    title: "I'm planning an event",
    description: 'Find and book vendors near you.',
    glyph: 'square',
    selectedCard: 'border-2 border-clay-400 bg-clay-100',
    selectedGlyph: 'border-clay-500',
  },
  {
    role: 'vendor',
    title: "I'm a vendor",
    description: 'List your services and take bookings.',
    glyph: 'circle',
    selectedCard: 'border-2 border-sage-400 bg-sage-50',
    selectedGlyph: 'border-sage-600',
  },
];

export interface SignUpFormProps {
  /**
   * Pre-selection from `?role=`, which "For vendors" in the nav carries.
   * `null` — the bare `/sign-up` — asks the question outright and shows the
   * both-sides panel, which picks no side before the visitor does.
   */
  initialRole: SignUpRole | null;
}

/**
 * Role is chosen before the Clerk form renders and travels with the sign-up as
 * `unsafeMetadata.role`. The API narrows and persists it on the local user row;
 * nothing downstream trusts this value on its own.
 *
 * The choice is irreversible, so it is made visibly: the cards stay on screen
 * after selection rather than collapsing to a line of text, and they sit side
 * by side at every width above 640 because they are a comparison — stacking
 * turns a choice into a scroll.
 *
 * Selecting a role also swaps the marketing panel beside the form. The form
 * column itself does not move: the choice is the only thing that changes the
 * page. See design/design-plan/21-sign-up.md.
 */
export function SignUpForm({ initialRole }: SignUpFormProps): React.ReactElement {
  const [role, setRole] = useState<SignUpRole | null>(initialRole);
  /* Set only when a submit was actually blocked, so the hint announces itself
     to a screen reader at the moment it becomes the reason nothing happened. */
  const [roleMissing, setRoleMissing] = useState(false);

  return (
    <AuthScreen
      headline="Let's get you set up"
      subhead="First — which one are you? This can't be changed later."
      panel={role ?? 'both'}
    >
      <fieldset className="mb-5.5">
        <legend className="sr-only">Which one are you?</legend>

        {/*
          Side by side at every width above 640: the two roles are a comparison,
          and stacking turns a choice into a scroll. At 390 the screen is a
          single column, per the degradation table in 30-responsive.md.
        */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROLE_CHOICES.map((choice) => {
            const isSelected = role === choice.role;

            return (
              <label
                key={choice.role}
                className={cn(
                  'cursor-pointer rounded-xl px-3.5 py-4 transition-colors duration-(--duration-fast)',
                  'has-focus-visible:ring-2 has-focus-visible:ring-clay-400/30 has-focus-visible:ring-offset-2',
                  isSelected
                    ? choice.selectedCard
                    : 'border border-stone-300 bg-stone-0 hover:border-stone-400',
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={choice.role}
                  checked={isSelected}
                  onChange={() => {
                    setRole(choice.role);
                    setRoleMissing(false);
                  }}
                  className="sr-only"
                />

                <span
                  aria-hidden="true"
                  className={cn(
                    'mb-2.5 flex size-8.5 items-center justify-center rounded-full',
                    isSelected ? 'bg-stone-0' : 'bg-stone-150',
                  )}
                >
                  <span
                    className={cn(
                      'block size-3.25 border-[1.6px]',
                      choice.glyph === 'circle' ? 'rounded-full' : 'rounded-[3px]',
                      isSelected ? choice.selectedGlyph : 'border-stone-600',
                    )}
                  />
                </span>

                <span className="block text-[14.5px] font-semibold text-stone-900">
                  {choice.title}
                </span>
                <span className="mt-1 block text-sm leading-normal text-stone-700">
                  {choice.description}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/*
        Clerk's fields stay mounted and editable with no role chosen — typing
        first and choosing second is a normal order, and disabling the inputs
        would punish it. Only the submit is gated.

        The gate is a capture-phase guard rather than a disabled button alone,
        because Clerk's form submits on Enter as well as on click and the button
        is Clerk's to render. A sign-up that got through with no role would
        carry no `role` in `unsafeMetadata`, and the API narrows a missing role
        to `customer` — putting a vendor on the wrong side of the product with
        no way back, which is the exact thing the subhead promises can't be
        changed later. `data-role-pending` is what globals.css keys the
        disabled treatment off. See design/design-plan/21-sign-up.md.
      */}
      <div
        data-role-pending={role === null ? '' : undefined}
        onSubmitCapture={(event) => {
          if (role === null) {
            event.preventDefault();
            event.stopPropagation();
            setRoleMissing(true);
          }
        }}
      >
        <SignUp unsafeMetadata={role ? { role } : {}} fallbackRedirectUrl="/after-sign-in" />

        {role === null ? (
          <p
            className="mt-1.5 text-center text-xs text-stone-600"
            role={roleMissing ? 'alert' : undefined}
          >
            Pick one above to continue
          </p>
        ) : null}
      </div>
    </AuthScreen>
  );
}
