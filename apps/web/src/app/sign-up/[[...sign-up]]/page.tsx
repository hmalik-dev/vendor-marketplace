'use client';

import { useState } from 'react';
import { SignUp } from '@clerk/nextjs';
import type { UserRole } from '@vendor-marketplace/shared';
import { AuthScreen } from '@/components/auth/auth-screen';
import { cn } from '@/lib/utils';

type SignUpRole = Extract<UserRole, 'customer' | 'vendor'>;

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
}

const ROLE_CHOICES: readonly RoleChoice[] = [
  {
    role: 'customer',
    title: "I'm planning an event",
    description: 'Find and book vendors near you.',
    glyph: 'square',
  },
  {
    role: 'vendor',
    title: "I'm a vendor",
    description: 'List your services and take bookings.',
    glyph: 'circle',
  },
];

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
 * See design/design-plan/21-sign-up.md.
 */
export default function SignUpPage(): React.ReactElement {
  const [role, setRole] = useState<SignUpRole | null>(null);

  return (
    <AuthScreen
      headline="Let's get you set up"
      subhead="First — which one are you? This can't be changed later."
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
                    ? 'border-2 border-clay-400 bg-clay-100'
                    : 'border border-stone-300 bg-stone-0 hover:border-stone-400',
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={choice.role}
                  checked={isSelected}
                  onChange={() => setRole(choice.role)}
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
                      isSelected ? 'border-clay-500' : 'border-stone-600',
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

      {role ? (
        <SignUp unsafeMetadata={{ role }} fallbackRedirectUrl="/after-sign-in" />
      ) : (
        <p className="text-center text-base text-stone-600">Pick one above to keep going.</p>
      )}
    </AuthScreen>
  );
}
