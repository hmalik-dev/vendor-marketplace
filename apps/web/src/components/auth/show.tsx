import { getServerSession } from '@/lib/auth/server';

interface ShowProps {
  when: 'signed-in' | 'signed-out';
  children: React.ReactNode;
}

/**
 * Renders its children for one auth state, decided on the server so the chrome
 * is right on first paint and never flashes between signed-out and signed-in.
 *
 * The state is the **session**, not the account record: a signed-in person
 * whose record cannot be read still holds a session and must not be shown a
 * signed-out header.
 */
export async function Show({ when, children }: ShowProps): Promise<React.ReactElement | null> {
  const signedIn = (await getServerSession()) !== null;

  return (when === 'signed-in') === signedIn ? <>{children}</> : null;
}
