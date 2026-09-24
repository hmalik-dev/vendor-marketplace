'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';

export interface HistoryLoadErrorProps {
  /** What could not be loaded, lower-case: "your bookings", "your reviews". */
  subject: string;
}

/**
 * A failed history read, drawn in the tab's own pane so the profile form and the
 * other tabs stay usable. Empty states say nothing exists; this says the read
 * failed, which a customer with a paid booking must not mistake for a lost one.
 * Retry re-renders the route, re-running the server reads.
 */
export function HistoryLoadError({ subject }: HistoryLoadErrorProps): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Banner
      status="failed"
      role="alert"
      title={`We couldn't load ${subject}`}
      action={
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
        >
          Try again
        </Button>
      }
    >
      This is a problem on our side. Your bookings are not affected.
    </Banner>
  );
}
