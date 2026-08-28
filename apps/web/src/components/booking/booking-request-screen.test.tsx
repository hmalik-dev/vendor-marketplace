import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AvailabilityStatus } from '@vendor-marketplace/shared';

const requestMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));

const { BookingRequestScreen } = await import('./booking-request-screen');

const TODAY = '2026-06-01';
const FREE_DATE = '2026-09-12';
const BLOCKED_DATE = '2026-09-13';
const BOOKED_DATE = '2026-09-14';

const CALENDAR: Record<string, AvailabilityStatus> = {
  [BLOCKED_DATE]: 'blocked',
  [BOOKED_DATE]: 'booked',
};

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
});

afterAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  requestMock.mockReset();
  // The screen keeps a draft per vendor now, and jsdom shares one storage
  // across the file — without this, each test starts inside the last one's
  // half-written request.
  window.localStorage.clear();
});

function renderScreen(
  overrides: Partial<React.ComponentProps<typeof BookingRequestScreen>> = {},
): void {
  render(
    <BookingRequestScreen
      vendorId="11111111-1111-4111-8111-111111111111"
      vendorSlug="kessler-and-co"
      vendor={{
        businessName: 'Kessler & Co.',
        avatarUrl: null,
        avgRating: 4.9,
        reviewCount: 127,
        categoryName: 'Photography',
      }}
      responseTimeHours={4}
      servicePackage={{
        id: 'pkg-1',
        name: 'Full day coverage',
        priceCents: 145_000,
        inclusions: ['6 hours', '2 photographers'],
        durationHours: 6,
        maxGuests: 300,
      }}
      calendar={CALENDAR}
      initialDate={FREE_DATE}
      today={TODAY}
      {...overrides}
    />,
  );
}

/** The frame's own two-column pairing: only the textareas get a row to themselves. */
describe('field layout', () => {
  it('pairs every field except the two textareas', () => {
    renderScreen();

    for (const label of ['Event date', 'Event type', 'Start time', 'Guest count']) {
      expect(screen.getByLabelText(label).closest('div')?.className).not.toContain('col-span-2');
    }

    expect(screen.getByLabelText('Venue or location').closest('.sm\\:col-span-2')).not.toBeNull();
    expect(
      screen.getByLabelText('Anything else they should know?').closest('.sm\\:col-span-2'),
    ).not.toBeNull();
  });
});

describe('the date question', () => {
  it('answers it in sage when the vendor is free', () => {
    renderScreen();

    expect(screen.getByText('Kessler & Co. is free on this date')).toBeDefined();
  });

  it('turns gold, not red, on a blocked date — and still lets it be sent', async () => {
    renderScreen({ initialDate: BLOCKED_DATE });

    expect(screen.getByText(/has this date blocked/)).toBeDefined();
    expect(screen.queryByText(/fields need fixing/)).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText('Event type'), 'wedding');
    await userEvent.click(screen.getByRole('button', { name: 'Continue to review' }));

    expect(screen.getByRole('heading', { name: 'Check this over before it goes' })).toBeDefined();
  });

  it('blocks a date the vendor is already taken on', async () => {
    renderScreen({ initialDate: BOOKED_DATE });

    await userEvent.click(screen.getByRole('button', { name: 'Continue to review' }));

    expect(screen.getByText(/is already taken on that date/)).toBeDefined();
  });
});

describe('validation', () => {
  it('says nothing until a submit is attempted, then counts and links', async () => {
    renderScreen();

    expect(screen.queryByText(/needs fixing/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Continue to review' }));

    expect(screen.getByText('One field needs fixing before this can go out')).toBeDefined();
    const link = screen.getByRole('link', { name: 'Event type' });
    expect(link.getAttribute('href')).toBe(
      `#${screen.getByLabelText('Event type').getAttribute('id')}`,
    );
  });

  /*
   * The select and the textarea render their own className, so the tier
   * styling reaches them only if they merge what the field hands down. They
   * shipped once without it: the message went red and the control did not.
   */
  it('puts the red border on the control, not only on the message', async () => {
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Continue to review' }));

    const select = screen.getByLabelText('Event type');
    expect(select.className).toContain('border-error-500');
    expect(select.getAttribute('aria-invalid')).toBe('true');
  });

  it('puts the gold border on a costly date rather than a red one', () => {
    renderScreen({ initialDate: BLOCKED_DATE });

    const date = screen.getByLabelText('Event date');
    expect(date.className).toContain('border-gold-400');
    expect(date.className).not.toContain('border-error-500');
  });

  it('clears the message once the field is corrected', async () => {
    renderScreen();

    await userEvent.click(screen.getByRole('button', { name: 'Continue to review' }));
    expect(screen.getByText(/needs fixing/)).toBeDefined();

    await userEvent.selectOptions(screen.getByLabelText('Event type'), 'wedding');

    expect(screen.queryByText(/needs fixing/)).toBeNull();
  });

  it('names the vendor guest ceiling rather than saying the number is invalid', async () => {
    renderScreen();

    await userEvent.selectOptions(screen.getByLabelText('Event type'), 'wedding');
    await userEvent.type(screen.getByLabelText('Guest count'), '450');
    await userEvent.click(screen.getByRole('button', { name: 'Continue to review' }));

    expect(
      screen.getByText(
        'Kessler & Co. covers events up to 300 guests. Enter 300 or fewer, or pick a larger package.',
      ),
    ).toBeDefined();
  });
});

describe('the rail', () => {
  it('keeps the reassurance directly above the primary action', () => {
    renderScreen();

    const reassurance = screen.getByText(/You’re requesting, not paying\./);
    const primary = screen.getByRole('button', { name: 'Continue to review' });

    expect(reassurance.closest('div')?.nextElementSibling?.contains(primary)).toBe(true);
  });

  it('replaces the package block with a required brief on a custom request', () => {
    renderScreen({ servicePackage: null });

    expect(screen.getByLabelText('Describe what you need')).toBeDefined();
    expect(screen.getByText('Set by the quote')).toBeDefined();
  });
});

describe('sending', () => {
  it('reviews first, then posts the request and lands on the success panel', async () => {
    requestMock.mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' });
    renderScreen();

    await userEvent.selectOptions(screen.getByLabelText('Event type'), 'wedding');
    await userEvent.type(screen.getByLabelText('Venue or location'), 'Barr Mansion');
    await userEvent.click(screen.getByRole('button', { name: 'Continue to review' }));

    expect(requestMock).not.toHaveBeenCalled();
    expect(screen.getByText('Barr Mansion')).toBeDefined();
    // Written the way the frame writes them, not as the input holds them.
    expect(screen.getByText('September 12, 2026')).toBeDefined();
    expect(screen.getAllByText('Not set')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));

    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0]?.[1]?.body).toMatchObject({
      packageId: 'pkg-1',
      eventDate: FREE_DATE,
      eventType: 'wedding',
      eventLocation: 'Barr Mansion',
    });

    expect(
      await screen.findByRole('heading', { name: 'Your request is with Kessler & Co.' }),
    ).toBeDefined();
    expect(screen.getByText(/usually replies within 4 hours/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'See your requests' })).toBeDefined();
  });

  it('keeps the form and says what happened when the send fails', async () => {
    requestMock.mockRejectedValue(new Error('offline'));
    renderScreen();

    await userEvent.selectOptions(screen.getByLabelText('Event type'), 'wedding');
    await userEvent.click(screen.getByRole('button', { name: 'Continue to review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));

    expect(await screen.findByText(/did not reach us/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDefined();
  });
});

/**
 * The form is long — occasion, date, time, guest count, venue, notes — and
 * until #58 a reload lost all of it. It is also what frame `26`'s
 * session-expired dialog promises is safe.
 */
describe('the request survives leaving the page', () => {
  const OTHER_VENDOR = '22222222-2222-4222-8222-222222222222';

  async function typeVenue(value: string): Promise<void> {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Venue or location'), value);
  }

  it('brings back what was typed, and says that it did', async () => {
    renderScreen();
    await typeVenue('The Marfa barn');

    cleanup();
    renderScreen();

    await waitFor(() =>
      expect((screen.getByLabelText('Venue or location') as HTMLInputElement).value).toBe(
        'The Marfa barn',
      ),
    );
    expect(screen.getByText(/We kept what you had written/)).toBeDefined();
  });

  /* A customer comparing two vendors has a half-written request to each. */
  it('keeps each vendor’s request to itself', async () => {
    renderScreen();
    await typeVenue('For Kessler');

    cleanup();
    renderScreen({ vendorId: OTHER_VENDOR });

    await waitFor(() =>
      expect((screen.getByLabelText('Venue or location') as HTMLInputElement).value).toBe(''),
    );
    expect(screen.queryByText(/We kept what you had written/)).toBeNull();
  });

  /* A form that fills itself is unsettling; an untouched one has nothing to say. */
  it('says nothing when there was no draft', () => {
    renderScreen();

    expect(screen.queryByText(/We kept what you had written/)).toBeNull();
  });

  it('starts the next request empty once one has been sent', async () => {
    requestMock.mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333' });
    renderScreen();

    await userEvent.selectOptions(screen.getByLabelText('Event type'), 'wedding');
    await typeVenue('The Marfa barn');
    await userEvent.click(screen.getByRole('button', { name: 'Continue to review' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));

    expect(
      await screen.findByRole('heading', { name: 'Your request is with Kessler & Co.' }),
    ).toBeDefined();

    cleanup();
    renderScreen();

    await waitFor(() =>
      expect((screen.getByLabelText('Venue or location') as HTMLInputElement).value).toBe(''),
    );
    expect(screen.queryByText(/We kept what you had written/)).toBeNull();
  });
});
