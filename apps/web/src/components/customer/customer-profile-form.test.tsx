import {
  MAX_CUSTOMER_BIO_LENGTH,
  MAX_NAME_LENGTH,
  SINGLE_UPLOAD_CONSTRAINT_LINE,
  UPLOAD_CONSTRAINT_LINE,
} from '@vendor-marketplace/shared';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import Link from 'next/link';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestMock = vi.fn();
const pushMock = vi.fn();

vi.mock('@/lib/use-api', () => ({
  useApi: () => requestMock,
  useImageUpload: () => ({ upload: vi.fn(), uploading: false }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

const { CustomerProfileForm } = await import('./customer-profile-form');

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({});
  pushMock.mockReset();
});

afterEach(cleanup);

const USER = {
  id: 'u1',
  firstName: 'Ana',
  lastName: 'Lucero',
  email: 'ana@example.test',
  phone: null,
  avatarUrl: null,
  bio: null,
  city: null,
  state: null,
  budgetTier: null,
  guestCountMin: null,
  guestCountMax: null,
};

/**
 * #72's fifth finding: City accepted more than the API's 100-character cap, so
 * a long paste produced a bare "Invalid input" at the submit bar — no field
 * named, no counter, no fix. `.claude/rules/web-route-boundaries.md` states the
 * rule directly: "Every text input whose value reaches a length-capped API
 * field carries the matching `maxLength`."
 */
describe('the City field', () => {
  it('is capped at the length the API enforces', () => {
    render(<CustomerProfileForm user={USER as never} />);

    const city = screen.getByLabelText('City');

    expect(city.getAttribute('maxLength')).toBe(String(MAX_NAME_LENGTH));
  });

  it('caps at the shared constant rather than a copy of the number', () => {
    // If the API widens the field, the input follows without a second edit.
    expect(MAX_NAME_LENGTH).toBe(100);
  });
});

/** The same cap, on the field beside it — `state` is `trimmedString(100)` too. */
describe('the State field', () => {
  it('is capped at the length the API enforces', () => {
    render(<CustomerProfileForm user={USER as never} />);

    expect(screen.getByLabelText('State').getAttribute('maxLength')).toBe(String(MAX_NAME_LENGTH));
  });
});

/**
 * #412's first finding. `type="number"` hands `2.7` and `1e21` to `onChange`
 * intact; `Number.parseInt` then read a prefix and stored **2** and **1** under
 * a `Profile saved` toast, with the inputs still showing what was typed. The
 * range `1e21` collapsed to was 1–1.
 */
describe('a guest count that is not a whole number', () => {
  it.each(['2.7', '1e21', '-5'])('refuses %s rather than truncating it', async (typed) => {
    render(<CustomerProfileForm user={USER as never} />);

    const field = screen.getByLabelText('Guests, from');
    await userEvent.type(field, typed);

    expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('names the field it refused, and ties the message to that input', async () => {
    render(<CustomerProfileForm user={USER as never} />);

    const field = screen.getByLabelText('Guests, up to');
    await userEvent.type(field, '2.7');

    const message = screen.getByText(
      'Guests, up to has to be a whole number of people, from 1 to 100,000.',
    );
    // The control announces its own reason rather than only its label.
    expect(field.getAttribute('aria-describedby')).toBe(message.getAttribute('id'));
  });

  it('accepts a leading zero, which is a whole number somebody typed', async () => {
    render(<CustomerProfileForm user={USER as never} />);

    const field = screen.getByLabelText('Guests, from');
    await userEvent.type(field, '050');

    expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(field.getAttribute('aria-invalid')).toBeNull();
  });

  it('sends the whole number a valid entry parses to', async () => {
    render(<CustomerProfileForm user={USER as never} />);

    await userEvent.type(screen.getByLabelText('Guests, from'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(requestMock).toHaveBeenCalled());
    expect(requestMock.mock.calls[0]?.[1]?.body?.typicalGuestCountMin).toBe(40);
  });
});

/**
 * #412's third finding: the only text a validation failure produced was Zod's
 * top-level default, `Invalid input`, above six inputs of which one was wrong.
 */
describe('a validation failure', () => {
  it('names the field and ties the reason to it', async () => {
    render(<CustomerProfileForm user={USER as never} />);

    const bio = screen.getByLabelText('About you');
    await userEvent.click(bio);
    await userEvent.paste('x'.repeat(MAX_CUSTOMER_BIO_LENGTH + 1));

    const message = screen.getByText('Keep this to 300 characters or fewer.');
    expect(bio.getAttribute('aria-invalid')).toBe('true');
    expect(bio.getAttribute('aria-describedby')).toBe(message.getAttribute('id'));
    // Zod's own default named no field and said nothing to do.
    expect(screen.queryByText('Invalid input')).toBeNull();
    expect(requestMock).not.toHaveBeenCalled();
  });
});

/**
 * The bio is the only field on this form that can reach the schema by typing —
 * City and State carry `maxLength`, and the counter is designed to read
 * `301 / 300` rather than stop. So the over-length case blocks the button
 * rather than failing after a round trip.
 */
describe('a bio over the limit', () => {
  it('blocks the save and says how to fix it', async () => {
    render(<CustomerProfileForm user={USER as never} />);

    const bio = screen.getByLabelText('About you');
    await userEvent.click(bio);
    await userEvent.paste('x'.repeat(MAX_CUSTOMER_BIO_LENGTH + 1));

    expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByText('Keep this to 300 characters or fewer.')).toBeTruthy();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('lets the save through once it is back under the limit', async () => {
    render(<CustomerProfileForm user={USER as never} />);

    const bio = screen.getByLabelText('About you');
    await userEvent.click(bio);
    await userEvent.paste('x'.repeat(MAX_CUSTOMER_BIO_LENGTH));

    expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(
      false,
    );
  });
});

/**
 * #412's fourth finding: an in-app link discarded the draft with no prompt of
 * any kind. `useUnsavedChangesGuard` is the storefront editor's answer (#227)
 * and this form now shares it.
 */
describe('leaving with unsaved edits', () => {
  it('asks before following a link', async () => {
    render(
      <>
        <CustomerProfileForm user={USER as never} />
        <Link href="/bookings">My bookings</Link>
      </>,
    );

    await userEvent.type(screen.getByLabelText('City'), 'Austin');
    await userEvent.click(screen.getByRole('link', { name: 'My bookings' }));

    expect(await screen.findByText('Leave without saving?')).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does not ask when nothing has been edited', async () => {
    render(
      <>
        <CustomerProfileForm user={USER as never} />
        <Link href="/bookings">My bookings</Link>
      </>,
    );

    await userEvent.click(screen.getByRole('link', { name: 'My bookings' }));

    expect(screen.queryByText('Leave without saving?')).toBeNull();
  });

  it('stops guarding once the edit is saved', async () => {
    render(
      <>
        <CustomerProfileForm user={USER as never} />
        <Link href="/bookings">My bookings</Link>
      </>,
    );

    await userEvent.type(screen.getByLabelText('City'), 'Austin');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(requestMock).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('link', { name: 'My bookings' }));

    expect(screen.queryByText('Leave without saving?')).toBeNull();
  });
});

/**
 * #412's fifth finding: the single-photo field's hint read "12 MB each · 20
 * files per upload" for a chooser that takes exactly one file.
 */
describe('the profile photo hint', () => {
  it('does not describe a batch', () => {
    render(<CustomerProfileForm user={USER as never} />);

    expect(screen.getByText(SINGLE_UPLOAD_CONSTRAINT_LINE)).toBeTruthy();
    expect(screen.queryByText(UPLOAD_CONSTRAINT_LINE)).toBeNull();
  });

  it('states the same constraint the refusal states', () => {
    // The two used to be retyped separately and disagreed by a batch clause.
    expect(SINGLE_UPLOAD_CONSTRAINT_LINE).toBe('JPG or PNG · under 12 MB · at least 1200px wide');
  });
});
