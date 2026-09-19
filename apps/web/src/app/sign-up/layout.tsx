import { redirectIfSignedIn } from '@/lib/current-user';

/**
 * The sign-up form is a Client Component — it picks the role before
 * the account is created — so the already-signed-in guard lives in this Server
 * Component wrapper instead.
 */
export default async function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  await redirectIfSignedIn();

  return <>{children}</>;
}
