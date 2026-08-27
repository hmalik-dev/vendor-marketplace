import { cleanup, render, screen } from '@testing-library/react';
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

const CUSTOMER = "I'm planning an event";
const VENDOR = "I'm a vendor";

describe('SignUpPage', () => {
  afterEach(() => {
    cleanup();
    signUpProps.mockClear();
  });

  it('asks for a role before rendering the Clerk form', () => {
    render(<SignUpPage />);

    expect(screen.queryByTestId('clerk-sign-up')).toBeNull();
    expect(screen.getByRole('radio', { name: new RegExp(CUSTOMER) })).toBeDefined();
    expect(screen.getByRole('radio', { name: new RegExp(VENDOR) })).toBeDefined();
  });

  /*
   * The choice is irreversible, so both options stay on screen after selection
   * rather than collapsing to a line of text — the visitor can still see what
   * they did not pick, and change it, right up until the form is submitted.
   */
  it('keeps both roles visible and selectable after one is chosen', async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));

    const vendor = screen.getByRole('radio', { name: new RegExp(VENDOR) });
    const customer = screen.getByRole('radio', { name: new RegExp(CUSTOMER) });

    expect(vendor).toHaveProperty('checked', true);
    expect(customer).toHaveProperty('checked', false);

    await user.click(customer);
    expect(screen.getByRole('radio', { name: new RegExp(CUSTOMER) })).toHaveProperty(
      'checked',
      true,
    );
    expect(signUpProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ unsafeMetadata: { role: 'customer' } }),
    );
  });

  it('carries the vendor role into Clerk as unsafe metadata', async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.click(screen.getByRole('radio', { name: new RegExp(VENDOR) }));

    expect(screen.getByTestId('clerk-sign-up')).toBeDefined();
    expect(signUpProps).toHaveBeenCalledWith(
      expect.objectContaining({ unsafeMetadata: { role: 'vendor' } }),
    );
  });

  it('carries the customer role into Clerk as unsafe metadata', async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));

    expect(signUpProps).toHaveBeenCalledWith(
      expect.objectContaining({ unsafeMetadata: { role: 'customer' } }),
    );
  });

  it('sends the new account to the role-resolving dashboard route', async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);

    await user.click(screen.getByRole('radio', { name: new RegExp(CUSTOMER) }));

    expect(signUpProps).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackRedirectUrl: '/after-sign-in' }),
    );
  });

  it('groups the two roles under one labelled choice', () => {
    render(<SignUpPage />);

    expect(screen.getByRole('group', { name: 'Which one are you?' })).toBeDefined();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  /*
   * The marketing panel is mechanism, not metrics: a placeholder number in
   * front of a hesitant sign-up is the worst possible place for one.
   * See design/design-plan/98-post-mvp.md.
   */
  it('states the three guarantees and no platform statistics', () => {
    render(<SignUpPage />);

    expect(screen.getByText('Real availability, not a contact form')).toBeDefined();
    expect(screen.getByText('Payment held until the event is complete')).toBeDefined();
    expect(screen.getByText('No service fee, ever')).toBeDefined();

    // Nothing on this screen may claim a scale the product does not have.
    expect(document.body.textContent).not.toMatch(/\d[\d,]*\s*(vendors|events|reviews|bookings)/i);
    expect(document.body.textContent).not.toMatch(/thousands|#1|trusted by/i);
  });
});
