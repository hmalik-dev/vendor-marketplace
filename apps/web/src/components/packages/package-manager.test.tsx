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

const { PackageManager } = await import('./package-manager');

afterEach(() => {
  cleanup();
  requestMock.mockReset();
});

function row(id: string, name: string, displayOrder: number): WireServicePackage {
  return {
    id,
    vendorId: '66666666-6666-4666-8666-666666666666',
    name,
    description: 'Four hours of documentary coverage and an online gallery.',
    priceCents: 120_000,
    priceType: 'fixed',
    durationHours: 4,
    maxGuests: null,
    inclusions: [],
    isActive: true,
    displayOrder,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
}

const FIRST = row('55555555-5555-4555-8555-555555555555', 'Half-day coverage', 0);
const PACKAGES = [FIRST, row('77777777-7777-4777-8777-777777777777', 'Full-day coverage', 1)];

const DIALOG_TITLE = 'Leave without saving?';

function renderManager(): void {
  render(<PackageManager initialPackages={PACKAGES} isPublished />);
}

/** The list row's select button; the row's switch and move buttons repeat the name. */
function pick(packageName: string): HTMLElement {
  const button = screen.getByText(packageName, { selector: 'span' }).closest('button');
  if (button === null) {
    throw new Error(`No list row for ${packageName}`);
  }
  return button;
}

function nameField(): HTMLInputElement {
  return screen.getByLabelText<HTMLInputElement>('Package name');
}

/** Opens the first package and types into it, leaving the form dirty. */
async function openAndEdit(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(pick('Half-day coverage'));
  await user.type(nameField(), ' edited');
}

describe('PackageManager — unsaved edits (VEN-521)', () => {
  it('asks before another package replaces a dirty editor; Keep editing keeps the text', async () => {
    const user = userEvent.setup();
    renderManager();
    await openAndEdit(user);

    await user.click(pick('Full-day coverage'));
    expect(await screen.findByText(DIALOG_TITLE)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    expect(nameField().value).toBe('Half-day coverage edited');
  });

  it('switches to the other package on Discard changes', async () => {
    const user = userEvent.setup();
    renderManager();
    await openAndEdit(user);

    await user.click(pick('Full-day coverage'));
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));

    await waitFor(() => expect(nameField().value).toBe('Full-day coverage'));
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
  });

  it('asks on Cancel when dirty, and closes the editor on Discard changes', async () => {
    const user = userEvent.setup();
    renderManager();
    await openAndEdit(user);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText(DIALOG_TITLE)).toBeTruthy();
    expect(nameField().value).toBe('Half-day coverage edited');

    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    await waitFor(() => expect(screen.queryByLabelText('Package name')).toBeNull());
    expect(screen.getByText('Pick a package to edit')).toBeTruthy();
  });

  it('does not ask when the form is clean, on a switch or on Cancel', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(pick('Half-day coverage'));

    await user.click(pick('Full-day coverage'));
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    expect(nameField().value).toBe('Full-day coverage');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    expect(screen.getByText('Pick a package to edit')).toBeTruthy();
  });

  it('does not ask again after a successful save', async () => {
    const user = userEvent.setup();
    requestMock.mockResolvedValue({ ...FIRST, name: 'Half-day coverage edited' });
    renderManager();
    await openAndEdit(user);

    await user.click(screen.getByRole('button', { name: 'Save package' }));
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(1));

    await user.click(pick('Full-day coverage'));

    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    await waitFor(() => expect(nameField().value).toBe('Full-day coverage'));
  });

  it('does not ask after saving a new package, which remounts the editor', async () => {
    const user = userEvent.setup();
    const created = row('88888888-8888-4888-8888-888888888888', 'Elopement', 2);
    requestMock.mockResolvedValue(created);
    renderManager();

    await user.click(screen.getByRole('button', { name: 'Add a package' }));
    await user.type(nameField(), 'Elopement');
    await user.type(
      screen.getByLabelText('What it includes, in a sentence or two'),
      'A quiet ceremony with full coverage.',
    );
    await user.type(screen.getByLabelText('Price'), '900');
    await user.click(screen.getByRole('button', { name: 'Add package' }));
    await waitFor(() => expect(requestMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(nameField().value).toBe('Elopement'));

    await user.click(pick('Full-day coverage'));

    expect(screen.queryByText(DIALOG_TITLE)).toBeNull();
    await waitFor(() => expect(nameField().value).toBe('Full-day coverage'));
  });

  it('withdraws the dialog when a save lands while it is open', async () => {
    const user = userEvent.setup();
    let resolveSave: (value: WireServicePackage) => void = () => undefined;
    requestMock.mockReturnValue(
      new Promise<WireServicePackage>((resolve) => {
        resolveSave = resolve;
      }),
    );
    renderManager();
    await openAndEdit(user);

    await user.click(screen.getByRole('button', { name: 'Save package' }));
    await user.click(pick('Full-day coverage'));
    expect(await screen.findByText(DIALOG_TITLE)).toBeTruthy();

    resolveSave({ ...FIRST, name: 'Half-day coverage edited' });

    await waitFor(() => expect(screen.queryByText(DIALOG_TITLE)).toBeNull());
  });

  it('holds a router link behind the same dialog while dirty', async () => {
    const user = userEvent.setup();
    const { default: Link } = await import('next/link');
    render(
      <>
        <PackageManager initialPackages={PACKAGES} isPublished />
        <Link href="/vendor/bookings">Bookings</Link>
      </>,
    );
    await openAndEdit(user);

    await user.click(screen.getByRole('link', { name: 'Bookings' }));

    expect(await screen.findByText(DIALOG_TITLE)).toBeTruthy();
  });
});
