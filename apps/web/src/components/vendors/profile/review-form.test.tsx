import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ERROR_CODES,
  MAX_TITLE_LENGTH,
  REVIEW_CONTENT_MAX_LENGTH,
} from '@vendor-marketplace/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';
import { ReviewForm } from './review-form';

const requestMock = vi.fn();
const onWritten = vi.fn();
const onCancel = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));

afterEach(cleanup);
beforeEach(() => {
  requestMock.mockReset();
  onWritten.mockReset();
  onCancel.mockReset();
});

function renderForm(): void {
  render(
    <ReviewForm
      businessName="June Harlow"
      bookingId="bkg-1"
      onCancel={onCancel}
      onWritten={onWritten}
    />,
  );
}

const BODY = 'They were unhurried and the pictures show it.';

describe('ReviewForm — the star input', () => {
  /*
   * `12-vendor-profile.md`: "Star inputs use a radio-group pattern, never a row
   * of buttons." Five mutually exclusive values are what a radio group *is* —
   * the arrow-key navigation, the single tab stop and the group name all come
   * from the platform rather than from re-implemented key handling.
   */
  it('is five radios in one group, not a row of buttons', () => {
    renderForm();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(new Set(radios.map((radio) => (radio as HTMLInputElement).name)).size).toBe(1);
    expect(screen.queryAllByRole('button', { name: /star/i })).toHaveLength(0);
  });

  it('names each rating rather than leaving five identical stars', () => {
    renderForm();

    expect(screen.getByRole('radio', { name: '1 star — Poor' })).toBeDefined();
    expect(screen.getByRole('radio', { name: '5 stars — Excellent' })).toBeDefined();
  });

  it('selects with the keyboard alone, one tab stop in', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.tab();
    await user.keyboard('{ArrowRight}');

    // The group takes one tab stop and the arrows move within it — the whole
    // reason this is a radio group.
    expect(
      (screen.getByRole('radio', { name: '2 stars — Below expectations' }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });
});

describe('ReviewForm — validation', () => {
  it('asks for the prompt the voice table names, never “Create review”', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: 'How was your experience?' })).toBeDefined();
    expect(screen.queryByText(/create review/i)).toBeNull();
  });

  /* `40-states.md`: red only after a submit attempt, and it says how to fix it. */
  it('stays silent until a submit is attempted, then names both blockers', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByText('Pick a rating from one to five stars')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Post review' }));

    expect(screen.getByText('Pick a rating from one to five stars')).toBeDefined();
    expect(screen.getByText('Say something about the day — at least 10 characters')).toBeDefined();
    expect(requestMock).not.toHaveBeenCalled();
  });

  /*
   * Found in the browser: the message was described on the `div` holding the
   * radios, and a `div` is not in the accessibility tree — so a screen-reader
   * user submitting an empty form heard about the missing body and never about
   * the missing rating. The description belongs on the controls themselves.
   */
  it('announces the rating error, and hangs it off the radios', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Post review' }));

    const message = screen.getByText('Pick a rating from one to five stars');
    expect(message.getAttribute('role')).toBe('alert');

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.getAttribute('aria-describedby')).toBe(message.id);
    }
  });

  it('counts how many characters are still owed', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Review'), 'Great');
    await user.click(screen.getByRole('button', { name: 'Post review' }));

    expect(screen.getByText('A few more words — you’re 5 characters short')).toBeDefined();
  });

  /* Whitespace is not content — the API trims before measuring, so this must. */
  it('does not count spaces towards the floor', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Review'), '          ');
    await user.click(screen.getByRole('button', { name: 'Post review' }));

    expect(screen.getByText('Say something about the day — at least 10 characters')).toBeDefined();
  });

  it('caps both text fields at the lengths the API accepts', () => {
    renderForm();

    expect(screen.getByLabelText('Headline (optional)').getAttribute('maxlength')).toBe(
      String(MAX_TITLE_LENGTH),
    );
    expect(screen.getByLabelText('Review').getAttribute('maxlength')).toBe(
      String(REVIEW_CONTENT_MAX_LENGTH),
    );
  });
});

describe('ReviewForm — submitting', () => {
  it('posts against the booking and reports back', async () => {
    const user = userEvent.setup();
    requestMock.mockResolvedValue({ id: 'rev-new' });
    renderForm();

    await user.click(screen.getByRole('radio', { name: '4 stars — Very good' }));
    await user.type(screen.getByLabelText('Headline (optional)'), '  Worth every penny  ');
    await user.type(screen.getByLabelText('Review'), `  ${BODY}  `);
    await user.click(screen.getByRole('button', { name: 'Post review' }));

    await waitFor(() => expect(onWritten).toHaveBeenCalledTimes(1));
    expect(requestMock).toHaveBeenCalledWith('/bookings/bkg-1/reviews', {
      schema: expect.anything(),
      method: 'POST',
      body: { rating: 4, title: 'Worth every penny', content: BODY },
    });
  });

  it('omits an empty headline rather than sending a blank one', async () => {
    const user = userEvent.setup();
    requestMock.mockResolvedValue({ id: 'rev-new' });
    renderForm();

    await user.click(screen.getByRole('radio', { name: '5 stars — Excellent' }));
    await user.type(screen.getByLabelText('Review'), BODY);
    await user.click(screen.getByRole('button', { name: 'Post review' }));

    await waitFor(() => expect(onWritten).toHaveBeenCalled());
    expect(requestMock.mock.calls[0]?.[1].body).toEqual({ rating: 5, content: BODY });
  });

  /*
   * Every refusal this endpoint produces is already a sentence written for a
   * reader — the booking has not completed, it has been reviewed, the language
   * cannot be published. Replacing them with a generic line would swap a
   * specific fix for a shrug.
   */
  it('shows the API’s own refusal', async () => {
    const user = userEvent.setup();
    requestMock.mockImplementation(() =>
      Promise.reject(
        new ApiClientError(409, ERROR_CODES.CONFLICT, 'You have already reviewed this booking'),
      ),
    );
    renderForm();

    await user.click(screen.getByRole('radio', { name: '5 stars — Excellent' }));
    await user.type(screen.getByLabelText('Review'), BODY);
    await user.click(screen.getByRole('button', { name: 'Post review' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('You have already reviewed this booking'),
    );
    expect(onWritten).not.toHaveBeenCalled();
  });

  it('distinguishes a request that never arrived from one that was refused', async () => {
    const user = userEvent.setup();
    requestMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    renderForm();

    await user.click(screen.getByRole('radio', { name: '5 stars — Excellent' }));
    await user.type(screen.getByLabelText('Review'), BODY);
    await user.click(screen.getByRole('button', { name: 'Post review' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Your review didn’t reach us. Check your connection and try again.',
      ),
    );
  });

  it('closes without posting when cancelled', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(requestMock).not.toHaveBeenCalled();
  });
});
