import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';
import { WriteReviewModal } from './write-review-modal';

const requestMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));

const REVIEW_ROW = {
  id: 'review-1',
  bookingId: 'booking-1',
  reviewerId: 'user-1',
  vendorId: 'vendor-1',
  type: 'customer_to_vendor',
  rating: 5,
  title: null,
  content: 'Wonderful to work with.',
  isPublic: true,
  createdAt: new Date('2026-06-01T00:00:00Z'),
};

beforeEach(() => {
  requestMock.mockReset();
});

afterEach(cleanup);

async function openModal(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Write a review' }));
}

describe('WriteReviewModal', () => {
  it('opens with the required prompt, never "Create review"', async () => {
    render(
      <WriteReviewModal
        bookingId="booking-1"
        businessName="Sunlit Studio"
        onSubmitted={() => {}}
      />,
    );

    await openModal();

    expect(screen.getByRole('heading', { name: 'How was your experience?' })).toBeDefined();
    expect(screen.queryByText('Create review')).toBeNull();
  });

  it('refuses to submit without a rating, and never calls the API', async () => {
    render(
      <WriteReviewModal
        bookingId="booking-1"
        businessName="Sunlit Studio"
        onSubmitted={() => {}}
      />,
    );
    await openModal();

    await userEvent.type(
      screen.getByLabelText('Your review'),
      'A lovely day, everything went smoothly.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send review' }));

    expect(screen.getByRole('alert').textContent).toBe('Choose a rating.');
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('sends bookingId, rating and content — never a type field the client could choose', async () => {
    requestMock.mockResolvedValue(REVIEW_ROW);
    const onSubmitted = vi.fn();

    render(
      <WriteReviewModal
        bookingId="booking-1"
        businessName="Sunlit Studio"
        onSubmitted={onSubmitted}
      />,
    );
    await openModal();

    await userEvent.click(screen.getByRole('radio', { name: 'five stars' }));
    await userEvent.type(
      screen.getByLabelText('Your review'),
      'A lovely day, everything went smoothly.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send review' }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith(REVIEW_ROW));

    expect(requestMock).toHaveBeenCalledTimes(1);
    const [path, options] = requestMock.mock.calls[0] as [
      string,
      { method: string; body: unknown },
    ];
    expect(path).toBe('/reviews');
    expect(options.method).toBe('POST');
    expect(options.body).toEqual({
      bookingId: 'booking-1',
      rating: 5,
      content: 'A lovely day, everything went smoothly.',
    });
    // No `type` key at all — the server derives it from the reviewer's identity.
    expect(options.body).not.toHaveProperty('type');
  });

  it('surfaces the server message for a rejected review, e.g. the profanity filter', async () => {
    requestMock.mockRejectedValue(
      new ApiClientError(400, 'VALIDATION_ERROR', 'Review contains inappropriate language'),
    );

    render(
      <WriteReviewModal
        bookingId="booking-1"
        businessName="Sunlit Studio"
        onSubmitted={() => {}}
      />,
    );
    await openModal();

    await userEvent.click(screen.getByRole('radio', { name: 'one star' }));
    await userEvent.type(screen.getByLabelText('Your review'), 'This was a genuinely bad day.');
    await userEvent.click(screen.getByRole('button', { name: 'Send review' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Review contains inappropriate language'),
    );
  });
});
