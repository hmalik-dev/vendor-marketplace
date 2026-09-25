import userEvent from '@testing-library/user-event';
import type { Category, MyVendorApplication } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const replace = vi.fn();
const requestMock = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('@/lib/use-api', () => ({ useApi: () => requestMock }));
const signOut = vi.fn<() => Promise<void>>();
vi.mock('@/lib/auth/auth-requests', () => ({ signOut: () => signOut() }));

const { VendorDetailsForm } = await import('./vendor-details-form');

const APPLICATION: MyVendorApplication = {
  email: 'mara@wildbloomflorals.com',
  businessName: null,
  category: null,
  city: null,
  state: null,
  message: null,
  complete: false,
};

const CATEGORIES: readonly Category[] = [
  {
    id: 'cat-florals',
    name: 'Florals & decor',
    slug: 'florals-decor',
    description: null,
    icon: null,
    displayOrder: 0,
    isActive: true,
  },
];

describe('VendorDetailsForm', () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
    requestMock.mockReset();
  });
  afterEach(cleanup);

  /*
   * Regression (VEN-582, parity-checker against frame 36): the email row is a
   * locked fact, not an editable field, so it reads "Your email" with a
   * "Verified" pill beside the address — not a bare "Email" input.
   */
  it('shows the verified email as a locked fact, not an editable field', () => {
    render(<VendorDetailsForm application={APPLICATION} categories={CATEGORIES} />);

    expect(screen.getByText('Your email')).toBeDefined();
    expect(screen.getByText('mara@wildbloomflorals.com')).toBeDefined();
    expect(screen.getByText('Verified')).toBeDefined();
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('labels the category field "Category", matching frame 36', () => {
    render(<VendorDetailsForm application={APPLICATION} categories={CATEGORIES} />);

    expect(screen.getByText('Category')).toBeDefined();
    expect(screen.queryByText('What you offer')).toBeNull();
  });

  it('annotates the optional field with an em dash, matching frame 36', () => {
    render(<VendorDetailsForm application={APPLICATION} categories={CATEGORIES} />);

    expect(screen.getByText('— optional')).toBeDefined();
    expect(screen.queryByText('(optional)')).toBeNull();
  });

  /*
   * Regression: the link field was a multi-line Textarea with the helper copy
   * folded into its placeholder, where frame 36 draws a single-line field with
   * a helper line that stays visible once something is typed.
   */
  it('renders the link field as a single-line input with a persistent helper line', () => {
    render(<VendorDetailsForm application={APPLICATION} categories={CATEGORIES} />);

    const field = screen.getByLabelText(/Link to your work/) as HTMLInputElement;
    expect(field.tagName).toBe('INPUT');
    expect(screen.getByText('Instagram, a website')).toBeDefined();
  });

  it('pre-fills a returning visitor’s saved answers', () => {
    render(
      <VendorDetailsForm
        application={{
          ...APPLICATION,
          businessName: 'Wildbloom Florals',
          category: 'cat-florals',
          city: 'Austin',
          state: 'TX',
        }}
        categories={CATEGORIES}
      />,
    );

    expect(screen.getByDisplayValue('Wildbloom Florals')).toBeDefined();
    expect(screen.getByDisplayValue('Austin')).toBeDefined();
  });
});

/* VEN-763, frame 36: a mandatory step is not a trap. */
describe('the way out', () => {
  it('draws one Sign out after the submit, which signs out once and lands home', async () => {
    signOut.mockResolvedValue(undefined);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const user = userEvent.setup();
    render(<VendorDetailsForm application={APPLICATION} categories={CATEGORIES} />);

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons.filter((label) => label === 'Sign out')).toHaveLength(1);
    expect(buttons.at(-1)).toBe('Sign out');
    expect(buttons.at(-2)).toBe('Add me to the waitlist');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/');
    expect(requestMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
