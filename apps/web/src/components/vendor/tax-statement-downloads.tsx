'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiBaseUrl } from '@/lib/api-base-url';
import { getSessionToken, refreshRefusedSessionToken } from '@/lib/auth/client';
import { REQUEST_DID_NOT_ARRIVE } from '@/lib/user-facing-error';

export interface TaxStatementDownloadsProps {
  /** Calendar years with at least one settled booking, newest first. */
  years: readonly number[];
}

/**
 * One yearly statement per year the vendor was paid in (VEN-725). The file is
 * a CSV, so it is fetched here rather than through `useApi`, then handed to the
 * browser as a download.
 */
export function TaxStatementDownloads({
  years,
}: TaxStatementDownloadsProps): React.ReactElement | null {
  const [busyYear, setBusyYear] = useState<number | null>(null);
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
        fetch(`${apiBaseUrl()}/vendor/tax/statement.csv?year=${year}`, {
          headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
          cache: 'no-store',
        });
      let response = await request(token);

      if (response.status === 401 && token) {
        const fresh = await refreshRefusedSessionToken(token);

        if (fresh && fresh !== token) {
          response = await request(fresh);
        }
      }

      if (!response.ok) {
        setError(`The ${year} statement could not be downloaded. Try again.`);
        return;
      }

      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');

      link.href = href;
      link.download = `statement-${year}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      // A task later: revoking in the same tick cancels the download in Firefox.
      setTimeout(() => URL.revokeObjectURL(href), 0);
    } catch {
      setError(REQUEST_DID_NOT_ARRIVE);
    } finally {
      setBusyYear(null);
    }
  }

  return (
    <div data-testid="tax-statement-downloads" className="mt-3 flex flex-col items-start gap-1">
      {years.map((year) => (
        <Button
          key={year}
          type="button"
          variant="ghost"
          disabled={busyYear !== null}
          onClick={() => void download(year)}
        >
          {busyYear === year ? 'Preparing…' : `${year} statement (CSV)`}
        </Button>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-error-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
