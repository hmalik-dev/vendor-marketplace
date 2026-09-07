import { ERROR_CODES, REPORT_REASON_LABELS } from '@vendor-marketplace/shared';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';

const request = vi.fn();
vi.mock('@/lib/use-api', () => ({ useApi: () => request }));

const { ReportDialog } = await import('./report-dialog');

const REVIEW_ID = '3b2f8c1e-8d55-4d3f-8f0d-3c9a5f21bb01';
const REFERENCE = 'ORL-4K7Q-P2';

function renderDialog(signedIn = true): void {
  render(
    <ReportDialog
      subjectType="review"
      subjectId={REVIEW_ID}
      subjectNoun="this review"
      signedIn={signedIn}
    />,
  );
}

/** Opens the dialog and picks a reason — everything the send needs. */
async function open(reason = REPORT_REASON_LABELS.harassment): Promise<void> {
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', { name: 'Report this review' }));
  await user.click(await screen.findByLabelText('What is wrong?'));
  await user.click(await screen.findByRole('option', { name: reason }));
}

describe('ReportDialog (#436)', () => {
  beforeEach(() => {
    request.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  /*
   * Reporting is authenticated, so a signed-out reader is offered the thing
   * that would let them do it rather than a form that can only fail.
   */
  it('sends a signed-out reader to sign in rather than offering a form', () => {
    renderDialog(false);

    const link = screen.getByRole('link', { name: 'Sign in to report this review' });
    expect(link.getAttribute('href')).toBe('/sign-in');
    expect(screen.queryByRole('button', { name: 'Report this review' })).toBeNull();
  });

  it('posts the subject and the reason, and hands back the reference', async () => {
    request.mockResolvedValue({ reference: REFERENCE });
    renderDialog();
    await open();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });

    expect(request.mock.calls[0]?.[0]).toBe('/reports');
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: { subjectType: 'review', subjectId: REVIEW_ID, reason: 'harassment' },
    });
    /* No `detail` key at all when nothing was typed — not an empty string. */
    expect(request.mock.calls[0]?.[1]?.body).not.toHaveProperty('detail');

    expect(await screen.findByText(REFERENCE)).toBeDefined();
  });

  it('will not send until a reason is chosen', async () => {
    renderDialog();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Report this review' }));

    expect(screen.getByRole('button', { name: 'Send report' }).hasAttribute('disabled')).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  /*
   * Acceptance 3's other half. A lane 429 rendering as the 500 page is the
   * failure this repository has hit before, so the refusal is asserted as copy
   * on this screen rather than as an exception the boundary catches.
   */
  it('states the rate limit on the dialog instead of throwing to the error boundary', async () => {
    request.mockRejectedValue(
      new ApiClientError(
        429,
        ERROR_CODES.RATE_LIMITED,
        'Too many requests. Please try again shortly.',
      ),
    );
    renderDialog();
    await open();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Send report' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Too many requests. Please try again shortly.');
    /* Still on the form, so the reader can wait and press it again. */
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDefined();
  });

  it('replaces a generic upstream message with copy written for this control', async () => {
    request.mockRejectedValue(
      new ApiClientError(500, ERROR_CODES.INTERNAL_ERROR, 'Internal server error'),
    );
    renderDialog();
    await open();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Send report' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'That report did not reach us. Check your connection and try again.',
    );
  });
});
