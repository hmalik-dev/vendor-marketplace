import type { Metadata } from 'next';
import { pageTitle } from '@vendor-marketplace/shared';
import { NotFoundScreen } from '@/components/errors/not-found-screen';

export const metadata: Metadata = { title: pageTitle('Page not found') };

/**
 * Frame `15`, inside the marketing shell the root layout draws.
 *
 * The screen itself is a component so the checkout segment can render the same
 * body under its own header — see `not-found-screen.tsx`.
 */
export default function NotFound(): React.ReactElement {
  return <NotFoundScreen />;
}
