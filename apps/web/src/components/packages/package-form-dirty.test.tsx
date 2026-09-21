import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireServicePackage } from '@/lib/wire-schemas';

const requestMock = vi.fn();

vi.mock('@/lib/use-api', () => ({
  useApi: () => requestMock,
  useImageUpload: () => vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { PackageForm } = await import('./package-form');

afterEach(() => {
  cleanup();
  requestMock.mockReset();
});

const OPENED: WireServicePackage = {
  id: '55555555-5555-4555-8555-555555555555',
  vendorId: '66666666-6666-4666-8666-666666666666',
  name: 'Half-day coverage',
  description: 'Four hours of documentary coverage and an online gallery.',
  priceCents: 120_000,
  priceType: 'fixed',
  durationHours: 4,
  maxGuests: null,
  inclusions: ['Online gallery'],
  isActive: true,
  displayOrder: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};
const MOVED: WireServicePackage = {
  ...OPENED,
  name: 'Renamed elsewhere',
  updatedAt: new Date('2026-01-05T00:00:00.000Z'),
};

function renderForm(onDirtyChange?: (isDirty: boolean) => void): void {
  render(
    <PackageForm
      servicePackage={OPENED}
      onSaved={vi.fn()}
      onCancel={vi.fn()}
      onDirtyChange={onDirtyChange}
    />,
  );
}

describe('PackageForm — reporting unsaved edits (VEN-521)', () => {
  it('is clean until an edit, dirty after it, and clean again when the edit is undone', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    renderForm(onDirtyChange);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await user.type(screen.getByLabelText('Package name'), '!');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.type(screen.getByLabelText('Package name'), '{Backspace}');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('clears dirty state after a successful save', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    requestMock.mockResolvedValue({ ...OPENED, name: 'Half-day coverage!' });
    renderForm(onDirtyChange);

    await user.type(screen.getByLabelText('Package name'), '!');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Save package' }));

    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('stays dirty after a 409 refusal and reads clean once the current values are loaded', async () => {
    const user = userEvent.setup();
    const { ApiClientError } = await import('@/lib/api-client');
    const onDirtyChange = vi.fn();
    requestMock.mockRejectedValueOnce(
      new ApiClientError(409, 'CONFLICT', 'changed', { current: MOVED }),
    );
    renderForm(onDirtyChange);

    const name = screen.getByLabelText<HTMLInputElement>('Package name');
    await user.clear(name);
    await user.type(name, 'My typed name');
    await user.click(screen.getByRole('button', { name: 'Save package' }));
    await screen.findByRole('alert');

    expect(name.value).toBe('My typed name');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole('button', { name: 'Load the current values' }));

    expect(name.value).toBe('Renamed elsewhere');
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('asks before an in-app link is followed while dirty, and not while clean', async () => {
    const user = userEvent.setup();
    const { default: Link } = await import('next/link');
    render(
      <>
        <PackageForm servicePackage={OPENED} onSaved={vi.fn()} onCancel={vi.fn()} />
        <Link href="/vendor/bookings">Bookings</Link>
      </>,
    );

    await user.click(screen.getByRole('link', { name: 'Bookings' }));
    expect(screen.queryByText('Leave without saving?')).toBeNull();

    await user.type(screen.getByLabelText('Package name'), '!');
    await user.click(screen.getByRole('link', { name: 'Bookings' }));
    expect(await screen.findByText('Leave without saving?')).toBeTruthy();
  });

  it('registers a beforeunload warning only while dirty', async () => {
    const user = userEvent.setup();
    renderForm();

    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await user.type(screen.getByLabelText('Package name'), '!');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
