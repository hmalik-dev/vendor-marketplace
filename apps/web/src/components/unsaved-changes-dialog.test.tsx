import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';

const guard = { pendingHref: '/bookings', confirmLeave: vi.fn(), cancelLeave: vi.fn() };

describe('UnsavedChangesDialog', () => {
  afterEach(() => {
    cleanup();
  });

  it('says what leaving costs in one sentence, naming the noun', () => {
    render(<UnsavedChangesDialog guard={guard} noun="package" />);

    expect(screen.getByText('Leaving now discards your changes to this package.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep editing' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeDefined();
  });

  it('defaults the noun to profile', () => {
    render(<UnsavedChangesDialog guard={guard} />);

    expect(screen.getByText('Leaving now discards your changes to this profile.')).toBeDefined();
  });

  it('stays closed while nothing is pending', () => {
    render(<UnsavedChangesDialog guard={{ ...guard, pendingHref: null }} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
