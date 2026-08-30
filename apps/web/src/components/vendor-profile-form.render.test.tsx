import { ERROR_CODES, type Category } from '@vendor-marketplace/shared';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';

const requestMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/lib/use-api', () => ({
  useApi: () => requestMock,
  useImageUpload: () => vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

const { VendorProfileForm } = await import('./vendor-profile-form');

function category(id: string, name: string, slug: string, displayOrder: number): Category {
  return { id, name, slug, description: null, icon: null, displayOrder, isActive: true };
}

const CATEGORIES: readonly Category[] = [
  category('11111111-1111-4111-8111-111111111111', 'Photography', 'photography', 1),
  category('22222222-2222-4222-8222-222222222222', 'Catering', 'catering', 2),
];

type User = ReturnType<typeof userEvent.setup>;

afterEach(() => {
  cleanup();
  requestMock.mockReset();
  refreshMock.mockReset();
});

/** A vendor onboarding: no profile row yet, so the form is in create mode. */
function renderOnboarding(): void {
  render(<VendorProfileForm profile={null} categories={CATEGORIES} allTags={[]} />);
}

async function chooseState(user: User): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: 'State' }));
  await user.click(await screen.findByRole('option', { name: 'Texas' }));
}

/**
 * Everything the create schema demands, so a submit reaches the API. Native
 * constraint validation stops a submit before React ever sees it, which is why
 * the `required` inputs are filled even in the tests about the server's answer.
 */
async function completeTheProfile(user: User): Promise<void> {
  await user.type(screen.getByLabelText('Business name'), 'Sunlit Studio');
  await user.type(screen.getByLabelText('City'), 'Austin');
  await chooseState(user);
  await user.click(screen.getByRole('button', { name: 'Photography' }));
}

function createProfile(user: User): Promise<void> {
  return user.click(screen.getByRole('button', { name: 'Create profile' }));
}

describe('VendorProfileForm — a save the API refuses', () => {
  /*
   * #222. The 400 was swallowed: no toast, no inline error, no `[role=alert]`,
   * no `aria-invalid`, no focus move. The button read as dead — the pass that
   * found it clicked Save four times — and onboarding could only be completed
   * by calling the API directly.
   */
  it('renders the refusal on the control the API names', async () => {
    const user = userEvent.setup();
    requestMock.mockRejectedValue(
      new ApiClientError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'One or more selected categories are unavailable. Reload the page and choose from the current list.',
        { field: 'categoryIds' },
      ),
    );
    renderOnboarding();

    await completeTheProfile(user);
    await createProfile(user);

    const message = await screen.findByText(
      'One or more selected categories are unavailable. Reload the page and choose from the current list.',
    );

    /*
     * Associated, not merely present. The picker is a group of buttons rather
     * than a form control, so the tie is `aria-describedby` on a named group —
     * `aria-invalid` is not global and would be inert on a generic element.
     */
    const picker = screen.getByRole('group', { name: 'Categories' });
    expect(message.id).toBe('categories-error');
    expect(picker.getAttribute('aria-describedby')).toBe('categories-error');
  });

  it('announces a refusal that belongs to no field, rather than dropping it', async () => {
    const user = userEvent.setup();
    requestMock.mockRejectedValue(
      new ApiClientError(409, ERROR_CODES.CONFLICT, 'That business name is already taken.'),
    );
    renderOnboarding();

    await completeTheProfile(user);
    await createProfile(user);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('That business name is already taken.');
  });

  /** A request that never arrived is not the vendor's profile being wrong. */
  it('distinguishes a failed request from a refused one', async () => {
    const user = userEvent.setup();
    requestMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderOnboarding();

    await completeTheProfile(user);
    await createProfile(user);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'Your profile did not reach us. Check your connection and save again.',
    );
  });

  it('clears the refusal once the vendor changes the control it named', async () => {
    const user = userEvent.setup();
    requestMock.mockRejectedValue(
      new ApiClientError(400, ERROR_CODES.VALIDATION_ERROR, 'Those categories are unavailable.', {
        field: 'categoryIds',
      }),
    );
    renderOnboarding();

    await completeTheProfile(user);
    await createProfile(user);
    await screen.findByText('Those categories are unavailable.');

    await user.click(screen.getByRole('button', { name: 'Catering' }));

    await waitFor(() => {
      expect(screen.queryByText('Those categories are unavailable.')).toBeNull();
    });
    expect(
      screen.getByRole('group', { name: 'Categories' }).getAttribute('aria-describedby'),
    ).toBeNull();
  });
});

describe('VendorProfileForm — a save the form itself refuses', () => {
  /*
   * The other half of the same defect: a schema failure was one toast naming
   * one issue, with nothing on the fields it named. Native validation covers
   * the empty `required` inputs, so these are the rules only the schema knows.
   */
  it('marks each rejected field and counts them at the head of the form', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.type(screen.getByLabelText('Business name'), 'A');
    await user.type(screen.getByLabelText('City'), 'Austin');
    await chooseState(user);
    await createProfile(user);

    expect(requestMock).not.toHaveBeenCalled();

    const summary = await screen.findByRole('alert');
    expect(summary.textContent).toContain('Two fields need fixing before this can go out');
    expect(screen.getByLabelText('Business name').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter your business name')).toBeTruthy();
    expect(screen.getByText('Select at least one category')).toBeTruthy();
  });

  /** The summary links to the control, so a long form does not have to be hunted. */
  it('links each counted field to its control', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    await user.type(screen.getByLabelText('Business name'), 'Sunlit Studio');
    await user.type(screen.getByLabelText('City'), 'Austin');
    await chooseState(user);
    await createProfile(user);

    const link = await screen.findByRole('link', { name: 'Categories' });
    expect(link.getAttribute('href')).toBe('#categories');
    expect(document.getElementById('categories')).not.toBeNull();
  });

  it('says nothing in red before a submit is attempted', () => {
    renderOnboarding();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Business name').getAttribute('aria-invalid')).toBeNull();
  });

  it('sends the profile once every blocking field is answered', async () => {
    const user = userEvent.setup();
    // The editor saves the profile and the tags through two endpoints in one
    // submit, and they answer with different shapes.
    requestMock.mockImplementation((path: string) =>
      path === '/vendor/tags'
        ? Promise.resolve([])
        : Promise.resolve({
            id: 'v1',
            slug: 'sunlit-studio',
            isPublished: false,
            publishBlockers: [],
            tags: [],
          }),
    );
    renderOnboarding();

    await completeTheProfile(user);
    await createProfile(user);

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith(
        '/vendor/profile',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
