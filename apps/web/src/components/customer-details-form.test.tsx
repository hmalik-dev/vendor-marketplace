import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_NAME_LENGTH } from '@vendor-marketplace/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
/* A full-load replace reports into `replace` too, so every navigation assertion reads one mock. */
const hardReplace = vi.fn((url: string) => replace(url));
const requestMock = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
const signOut = vi.fn<() => Promise<void>>();
vi.mock('@/lib/auth/auth-requests', () => ({ signOut: () => signOut() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const { CustomerDetailsForm } = await import('./customer-details-form');

const SAVED = { id: 'u1', firstName: 'Ada', lastName: 'Lovelace', role: 'customer' };

function firstName(): HTMLInputElement {
  return screen.getByLabelText('First name') as HTMLInputElement;
}

function lastName(): HTMLInputElement {
  return screen.getByLabelText('Last name') as HTMLInputElement;
}

describe('CustomerDetailsForm', () => {
  beforeEach(() => {
    replace.mockReset();
    hardReplace.mockClear();
    vi.stubGlobal('location', { ...window.location, replace: hardReplace });
    requestMock.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /* Not the last step for everyone, so the screen claims no position in the flow. */
  it('asks for the name under its heading alone, with no step eyebrow', () => {
    render(<CustomerDetailsForm returnTo={null} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('What should we call you?');
    expect(screen.getByText('Vendors see this name once you request a booking.')).toBeDefined();
    expect(screen.queryByText(/last step/i)).toBeNull();
  });

  /* Frame 41: exactly two inputs, Continue and Sign out, no skip. */
  it('offers two inputs, Continue and Sign out — and no way to skip', () => {
    render(<CustomerDetailsForm returnTo={null} />);

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Continue',
      'Sign out',
    ]);
    expect(screen.queryByText(/skip|later/i)).toBeNull();
  });

  it('focuses the first name on mount and carries the length and autofill hints', () => {
    render(<CustomerDetailsForm returnTo={null} />);

    expect(document.activeElement).toBe(firstName());
    expect(firstName().maxLength).toBe(MAX_NAME_LENGTH);
    expect(lastName().maxLength).toBe(MAX_NAME_LENGTH);
    expect(firstName().autocomplete).toBe('given-name');
    expect(lastName().autocomplete).toBe('family-name');
  });

  it('starts with empty fields and no error showing', () => {
    render(<CustomerDetailsForm returnTo={null} />);

    expect(firstName().value).toBe('');
    expect(lastName().value).toBe('');
    expect(screen.queryByText(/We need your/)).toBeNull();
    expect(firstName().getAttribute('aria-invalid')).toBeNull();
  });

  it('renders through the shared first-run shell', () => {
    render(<CustomerDetailsForm returnTo={null} />);

    const shell = screen.getByTestId('first-run-shell');

    expect(shell.contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
    expect(shell.contains(screen.getByTestId('logo'))).toBe(true);
    expect(shell.hasAttribute('data-auth-screen')).toBe(true);
  });

  /* VEN-701: a mandatory step is not a trap, so it carries its own way out. */
  it('signs the customer out and lands them on the home page', async () => {
    signOut.mockResolvedValue(undefined);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo="/bookings" />);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/');
    expect(requestMock).not.toHaveBeenCalled();
  });

  /* Frame 41: the link stacks below the button, it does not sit beside it. */
  it('draws Sign out under Continue, as a link-styled control', () => {
    render(<CustomerDetailsForm returnTo={null} />);

    const signOutButton = screen.getByRole('button', { name: 'Sign out' });
    const submit = screen.getByRole('button', { name: 'Continue' });

    expect(
      submit.compareDocumentPosition(signOutButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    /* Both are direct children of the form column, so neither shares a flex row with the other. */
    expect(signOutButton.parentElement).toBe(submit.parentElement);
    expect(signOutButton.className).toContain('block');
    expect(signOutButton.className).toContain('text-clay-500');
    expect(submit.className).toContain('w-full');
  });

  /* A blur error would shift the buttons under the pointer and lose the click. */
  it('does not blur the focused field when Sign out or Continue is pressed', async () => {
    signOut.mockResolvedValue(undefined);
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() });
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo={null} />);

    await user.pointer({
      keys: '[MouseLeft>]',
      target: screen.getByRole('button', { name: 'Sign out' }),
    });

    expect(document.activeElement).toBe(firstName());
    expect(screen.queryByText('We need your first name.')).toBeNull();

    await user.pointer({ keys: '[/MouseLeft]' });
    await user.pointer({
      keys: '[MouseLeft>]',
      target: screen.getByRole('button', { name: 'Continue' }),
    });

    expect(document.activeElement).toBe(firstName());
    expect(screen.queryByText('We need your first name.')).toBeNull();
  });

  describe('field errors (frame 41b)', () => {
    it('shows the first-name error on blur, on that field only', async () => {
      const user = userEvent.setup();
      render(<CustomerDetailsForm returnTo={null} />);

      /* The first field is already focused on mount, so one Tab leaves it. */
      expect(document.activeElement).toBe(firstName());
      await user.tab();

      const message = screen.getByText('We need your first name.');
      expect(firstName().getAttribute('aria-invalid')).toBe('true');
      expect(firstName().getAttribute('aria-describedby')).toBe(message.id);
      expect(lastName().getAttribute('aria-invalid')).toBeNull();
      expect(screen.queryByText('We need your last name too.')).toBeNull();
    });

    it('names both fields when an empty form is submitted, and calls nothing', async () => {
      const user = userEvent.setup();
      render(<CustomerDetailsForm returnTo={null} />);

      await user.click(screen.getByRole('button', { name: 'Continue' }));

      const first = screen.getByText('We need your first name.');
      const last = screen.getByText('We need your last name too.');
      expect(firstName().getAttribute('aria-describedby')).toBe(first.id);
      expect(lastName().getAttribute('aria-describedby')).toBe(last.id);
      expect(firstName().getAttribute('aria-invalid')).toBe('true');
      expect(lastName().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(firstName());
      expect(requestMock).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    it('treats a name of only spaces as empty', async () => {
      const user = userEvent.setup();
      render(<CustomerDetailsForm returnTo={null} />);

      await user.type(firstName(), '   ');
      await user.type(lastName(), 'Lovelace');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(screen.getByText('We need your first name.')).toBeDefined();
      expect(screen.queryByText('We need your last name too.')).toBeNull();
      expect(requestMock).not.toHaveBeenCalled();
    });

    it('clears an error as soon as its field is fixed', async () => {
      const user = userEvent.setup();
      render(<CustomerDetailsForm returnTo={null} />);

      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.type(firstName(), 'A');

      expect(screen.queryByText('We need your first name.')).toBeNull();
      expect(firstName().getAttribute('aria-invalid')).toBeNull();
      expect(screen.getByText('We need your last name too.')).toBeDefined();
    });
  });

  describe('saving and a failed save (frame 41b)', () => {
    it('disables both inputs and the button and reads Saving while the request is pending', async () => {
      requestMock.mockReturnValue(new Promise(() => undefined));
      const user = userEvent.setup();
      render(<CustomerDetailsForm returnTo={null} />);

      await user.type(firstName(), 'Ada');
      await user.type(lastName(), 'Lovelace');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      const submit = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      expect(submit.disabled).toBe(true);
      expect(submit.textContent).toBe('Saving');
      expect(firstName().disabled).toBe(true);
      expect(lastName().disabled).toBe(true);
      expect(firstName().value).toBe('Ada');
    });

    it('says nothing was lost, offers Try again and keeps what was typed when the save fails', async () => {
      requestMock.mockRejectedValueOnce(new Error('boom'));
      requestMock.mockResolvedValueOnce(SAVED);
      const user = userEvent.setup();
      render(<CustomerDetailsForm returnTo={null} />);

      await user.type(firstName(), 'Ada');
      await user.type(lastName(), 'Lovelace');
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(await screen.findByText("We couldn't save your name")).toBeDefined();
      expect(screen.getByText('What you typed is still here. Try again.')).toBeDefined();
      expect(firstName().value).toBe('Ada');
      expect(lastName().value).toBe('Lovelace');
      expect(firstName().disabled).toBe(false);
      expect(replace).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Try again' }));

      expect(requestMock).toHaveBeenCalledTimes(2);
      expect(requestMock).toHaveBeenLastCalledWith(
        '/users/me',
        expect.objectContaining({ body: { firstName: 'Ada', lastName: 'Lovelace' } }),
      );
      expect(replace).toHaveBeenCalledWith('/after-sign-in');
    });
  });

  it('writes the name via PUT /users/me and continues through /after-sign-in', async () => {
    requestMock.mockResolvedValue(SAVED);
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo={null} />);

    await user.type(firstName(), 'Ada');
    await user.type(lastName(), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(requestMock).toHaveBeenCalledWith(
      '/users/me',
      expect.objectContaining({
        method: 'PUT',
        body: { firstName: 'Ada', lastName: 'Lovelace' },
      }),
    );
    expect(replace).toHaveBeenCalledWith('/after-sign-in');
    // A full load, so the header re-reads the record and draws the new initials.
    expect(hardReplace).toHaveBeenCalledWith('/after-sign-in');
  });

  it('carries a validated returnTo through to /after-sign-in', async () => {
    requestMock.mockResolvedValue(SAVED);
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo="/vendors/june-harlow/request" />);

    await user.type(firstName(), 'Ada');
    await user.type(lastName(), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(replace).toHaveBeenCalledWith(
      '/after-sign-in?returnTo=%2Fvendors%2Fjune-harlow%2Frequest',
    );
  });
});
