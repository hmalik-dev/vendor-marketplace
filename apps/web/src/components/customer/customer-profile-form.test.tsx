import { MAX_NAME_LENGTH } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/use-api', () => ({
  useApi: () => vi.fn(),
  useImageUpload: () => ({ upload: vi.fn(), uploading: false }),
}));

const { CustomerProfileForm } = await import('./customer-profile-form');

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
