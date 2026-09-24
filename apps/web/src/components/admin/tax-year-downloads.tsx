'use client';

import { apiErrorSchema, ERROR_CODES } from '@vendor-marketplace/shared';
import { useState } from 'react';
import { StepUpPanel } from '@/components/admin/step-up-panel';
import { Button } from '@/components/ui/button';
import { apiBaseUrl } from '@/lib/api-base-url';
import { getSessionToken, refreshRefusedSessionToken } from '@/lib/auth/client';
import { REQUEST_DID_NOT_ARRIVE } from '@/lib/user-facing-error';

export interface TaxYearDownloadsProps {
  /** Calendar years with at least one settled booking, newest first. */
  years: readonly number[];
}

/**
 * One download per tax year (VEN-722, D49): the 1099-K figures in Stripe import
 * format. The file is a CSV, not JSON, so it is fetched here rather than through
 * `useApi`; an export of every vendor's tax figures asks for the emailed code
 * first, like the other hand-overs, and the pressed year is retried once it
 * is entered.
 */
export function TaxYearDownloads({ years }: TaxYearDownloadsProps): React.ReactElement | null {
  const [busyYear, setBusyYear] = useState<number | null>(null);
  const [stepUpYear, setStepUpYear] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (years.length === 0) {
    return null;
  }

  async function download(year: number): Promise<void> {
    setBusyYear(year);
    setError(null);

    try {
      const token = await getSessionToken();
      const request = (bearer: string | null): Promise<Response> =>
        fetch(`${apiBaseUrl()}/admin/tax/1099-k.csv?year=${year}`, {
          headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
          cache: 'no-store',
        });
      let response = await request(token);

      // A token the API refused is re-minted once (VEN-717), as `apiRequest` does for JSON calls.
      if (response.status === 401 && token) {
        const fresh = await refreshRefusedSessionToken(token);

        if (fresh && fresh !== token) {
          response = await request(fresh);
        }
      }

      if (!response.ok) {
        let body: unknown = null;

        try {
          body = await response.json();
        } catch {
          // Not an API error body (a gateway page): the generic sentence below covers it.
        }

        const parsed = apiErrorSchema.safeParse(body);

        if (parsed.success && parsed.data.error === ERROR_CODES.STEP_UP_REQUIRED) {
          setStepUpYear(year);
          return;
        }

        setStepUpYear(null);
        setError(
          parsed.success && parsed.data.error === ERROR_CODES.ADMIN_CEILING_REACHED
            ? parsed.data.message
            : `The ${year} figures could not be downloaded. Try again.`,
        );
        return;
      }

      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');

      link.href = href;
      link.download = `1099-k-${year}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      // A task later: revoking in the same tick cancels the download in Firefox.
      setTimeout(() => URL.revokeObjectURL(href), 0);
      setStepUpYear(null);
    } catch {
      setStepUpYear(null);
      setError(REQUEST_DID_NOT_ARRIVE);
    } finally {
      setBusyYear(null);
    }
  }

  return (
    <div data-testid="tax-year-downloads" className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {years.map((year) => (
          <Button
            key={year}
            type="button"
            variant="secondary"
            disabled={busyYear !== null}
            onClick={() => void download(year)}
          >
            {busyYear === year ? 'Preparing…' : `1099-K figures, ${year}`}
          </Button>
        ))}
      </div>
      {stepUpYear !== null ? (
        <StepUpPanel
          lead="This downloads every vendor's tax figures, so confirm it is you first."
          onVerified={() => download(stepUpYear)}
          onCancel={() => setStepUpYear(null)}
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-error-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
