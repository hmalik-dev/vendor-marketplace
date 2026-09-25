'use client';

import { SignOutButton } from '@/components/auth/sign-out-button';

/**
 * A gate screen's way out, drawn as a link under its primary (frames 36, 40,
 * 45b, 53). Screens that hide the site header, or that every other route
 * redirects to, would otherwise hold a signed-in person with no exit.
 */
export function SignOutLink({ disabled = false }: { disabled?: boolean }): React.ReactElement {
  return (
    <SignOutButton>
      <button
        type="button"
        disabled={disabled}
        className="mx-auto block text-action font-semibold text-clay-500 hover:text-clay-600 hover:underline disabled:opacity-50"
      >
        Sign out
      </button>
    </SignOutButton>
  );
}
