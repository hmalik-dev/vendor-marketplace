'use client';

import { useState } from 'react';
import { SignUp } from '@clerk/nextjs';
import type { UserRole } from '@vendorhub/shared';
import { Button } from '@/components/ui/button';

type SignUpRole = Extract<UserRole, 'customer' | 'vendor'>;

const ROLE_CHOICES: ReadonlyArray<{ role: SignUpRole; title: string; description: string }> = [
  {
    role: 'customer',
    title: "I'm planning an event",
    description: 'Search vendors, request quotes, and book the ones you like.',
  },
  {
    role: 'vendor',
    title: 'I offer event services',
    description: 'List your packages, manage availability, and get paid.',
  },
];

/**
 * Role is chosen before the Clerk form renders and travels with the sign-up as
 * `unsafeMetadata.role`. The API narrows and persists it on the local user row;
 * nothing downstream trusts this value on its own.
 */
export default function SignUpPage(): React.ReactElement {
  const [role, setRole] = useState<SignUpRole | null>(null);

  const chosen = ROLE_CHOICES.find((choice) => choice.role === role);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-semibold text-stone-800">Create your account</h1>

      {chosen ? (
        <>
          <p className="mt-3 text-center text-stone-600">
            Signing up as <span className="font-medium text-stone-800">{chosen.title}</span>.{' '}
            <button
              type="button"
              onClick={() => setRole(null)}
              className="text-primary-600 underline underline-offset-4 hover:text-primary-700"
            >
              Change
            </button>
          </p>

          <div className="mt-8">
            <SignUp unsafeMetadata={{ role: chosen.role }} fallbackRedirectUrl="/after-sign-in" />
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-center text-stone-600">
            First, tell us which side of VendorHub you are on. This cannot be changed later.
          </p>

          <ul className="mt-8 grid w-full gap-4 sm:grid-cols-2">
            {ROLE_CHOICES.map((choice) => (
              <li key={choice.role}>
                <div className="flex h-full flex-col rounded-lg border border-stone-150 bg-card p-6 shadow-sm">
                  <h2 className="font-display text-lg font-semibold text-stone-800">
                    {choice.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm text-stone-600">{choice.description}</p>
                  <Button
                    variant="cta"
                    size="cta"
                    className="mt-6 w-full"
                    onClick={() => setRole(choice.role)}
                  >
                    Continue
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
