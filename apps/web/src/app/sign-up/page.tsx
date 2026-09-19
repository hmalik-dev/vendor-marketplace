import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { SignUpForm, type SignUpRole } from '@/components/auth/sign-up-form';

export const metadata: Metadata = { title: pageTitle('Sign up') };

/**
 * The header's "List your services" link, and every vendor CTA on the landing
 * page, arrive at `/sign-up?role=vendor`. Anything else — including a value the
 * account holder typed themselves — falls back to asking the question outright,
 * because the role is irreversible and an unrecognised string must never quietly
 * become a choice. The value is a *pre-selection*, not authority: the API
 * narrows `unsafeMetadata.role` again before any user row is written.
 */
function readRole(value: string | string[] | undefined): SignUpRole | null {
  return value === 'vendor' || value === 'customer' ? value : null;
}

/**
 * A Server Component so `?role=` is read on the server and the right role card
 * and marketing panel are in the first paint — a pre-selection that arrives a
 * frame late reads as the page changing its mind. The stateful part is
 * `SignUpForm`. See design/design-plan/21-sign-up.md.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const { role } = await searchParams;

  return <SignUpForm initialRole={readRole(role)} />;
}
