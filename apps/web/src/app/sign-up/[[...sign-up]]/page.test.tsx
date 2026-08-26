import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const signUpProps = vi.fn<(props: Record<string, unknown>) => void>();

vi.mock('@clerk/nextjs', () => ({
  SignUp: (props: Record<string, unknown>) => {
    signUpProps(props);
    return <div data-testid="clerk-sign-up" />;
  },
}));

const { default: SignUpPage } = await import('./page');

describe('SignUpPage', () => {
  afterEach(() => {
    cleanup();
    signUpProps.mockClear();
  });

  it('asks for a role before rendering the Clerk form', () => {
    render(<SignUpPage />);

    expect(screen.queryByTestId('clerk-sign-up')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: "I'm planning an event" })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'I offer event services' })).toBeDefined();
  });

  it('carries the vendor role into Clerk as unsafe metadata', async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    const vendorCard = screen
      .getByRole('heading', { name: 'I offer event services' })
      .closest('li');
    expect(vendorCard).not.toBeNull();

    await user.click(within(vendorCard!).getByRole('button', { name: 'Continue' }));

    expect(screen.getByTestId('clerk-sign-up')).toBeDefined();
    expect(signUpProps).toHaveBeenCalledWith(
      expect.objectContaining({ unsafeMetadata: { role: 'vendor' } }),
    );
  });

  it('carries the customer role into Clerk as unsafe metadata', async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    const customerCard = screen
      .getByRole('heading', { name: "I'm planning an event" })
      .closest('li');

    await user.click(within(customerCard!).getByRole('button', { name: 'Continue' }));

    expect(signUpProps).toHaveBeenCalledWith(
      expect.objectContaining({ unsafeMetadata: { role: 'customer' } }),
    );
  });

  it('sends the new account to the role-resolving dashboard route', async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    const customerCard = screen
      .getByRole('heading', { name: "I'm planning an event" })
      .closest('li');

    await user.click(within(customerCard!).getByRole('button', { name: 'Continue' }));

    expect(signUpProps).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackRedirectUrl: '/dashboard' }),
    );
  });

  it('lets the visitor go back and pick the other role', async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    const vendorCard = screen
      .getByRole('heading', { name: 'I offer event services' })
      .closest('li');
    await user.click(within(vendorCard!).getByRole('button', { name: 'Continue' }));

    await user.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.queryByTestId('clerk-sign-up')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: "I'm planning an event" })).toBeDefined();
  });
});
