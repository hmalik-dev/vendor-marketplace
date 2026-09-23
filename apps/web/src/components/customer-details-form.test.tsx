import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const requestMock = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));

const { CustomerDetailsForm } = await import('./customer-details-form');

describe('CustomerDetailsForm', () => {
  beforeEach(() => {
    replace.mockReset();
    requestMock.mockReset();
  });
  afterEach(cleanup);

  it('refuses an empty submission client-side, without calling the API', async () => {
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo={null} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Enter your first and last name.')).toBeDefined();
    expect(requestMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('writes the name via PUT /users/me and continues through /after-sign-in', async () => {
    requestMock.mockResolvedValue({
      id: 'u1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'customer',
    });
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo={null} />);

    await user.type(screen.getByLabelText('First name'), 'Ada');
    await user.type(screen.getByLabelText('Last name'), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(requestMock).toHaveBeenCalledWith(
      '/users/me',
      expect.objectContaining({
        method: 'PUT',
        body: { firstName: 'Ada', lastName: 'Lovelace' },
      }),
    );
    expect(replace).toHaveBeenCalledWith('/after-sign-in');
  });

  it('carries a validated returnTo through to /after-sign-in', async () => {
    requestMock.mockResolvedValue({
      id: 'u1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'customer',
    });
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo="/vendors/june-harlow/request" />);

    await user.type(screen.getByLabelText('First name'), 'Ada');
    await user.type(screen.getByLabelText('Last name'), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(replace).toHaveBeenCalledWith(
      '/after-sign-in?returnTo=%2Fvendors%2Fjune-harlow%2Frequest',
    );
  });

  it('shows the API refusal and stays on the step when the save fails', async () => {
    requestMock.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<CustomerDetailsForm returnTo={null} />);

    await user.type(screen.getByLabelText('First name'), 'Ada');
    await user.type(screen.getByLabelText('Last name'), 'Lovelace');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText("That didn't save — try again.")).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });
});
