import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();

vi.mock('@/lib/use-api', () => ({ useApi: () => post }));

const { VendorApplicationForm } = await import('./vendor-application-form');

function fill(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

afterEach(() => {
  cleanup();
  post.mockReset();
});

describe('VendorApplicationForm', () => {
  it('applies with the refused session address, which cannot be edited', async () => {
    post.mockResolvedValue({ received: true });
    render(<VendorApplicationForm sessionEmail="refused@example.com" />);

    const email = screen.getByLabelText('Email') as HTMLInputElement;
    expect([email.value, email.readOnly]).toEqual(['refused@example.com', true]);

    fill('Business name', 'Fern & Gather');
    fill('What you offer', 'Florist');
    fill('City', 'Austin');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to join' }));
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toBe('/vendor-applications');
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: {
        email: 'refused@example.com',
        businessName: 'Fern & Gather',
        category: 'Florist',
        city: 'Austin',
        message: '',
      },
    });
    expect(screen.getByText(/We will email refused@example\.com if we invite you\./)).toBeDefined();
  });

  it('sends nothing until the required fields are filled', async () => {
    render(<VendorApplicationForm sessionEmail={null} />);

    fill('Email', 'visitor@example.com');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply to join' }));
    });

    expect(post).not.toHaveBeenCalled();
    expect(
      screen.getByText('Fill in your email, business name, what you offer and your city.'),
    ).toBeDefined();
  });
});
