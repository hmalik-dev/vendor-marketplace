import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireServicePackage } from '@/lib/wire-schemas';

const requestMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@/lib/use-api', () => ({
  useApi: () => requestMock,
  useImageUpload: () => vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock, success: vi.fn() },
}));

const { PackageForm } = await import('./package-form');

afterEach(() => {
  cleanup();
  requestMock.mockReset();
  toastErrorMock.mockReset();
});

/** A vendor adding their first package: nothing is filled in. */
function renderNewPackage(): void {
  render(<PackageForm servicePackage={null} onSaved={vi.fn()} onCancel={vi.fn()} />);
}

function addPackage(): Promise<void> {
  return userEvent.click(screen.getByRole('button', { name: 'Add package' }));
}

/*
 * #388: every blocking field here was a native `required`, and the form had no
 * `noValidate` — so the browser cancelled the submit, `save` never ran, and a
 * pristine press produced no POST, no `aria-invalid`, no `role=alert` and no
 * message anywhere on the page. The button read as broken.
 */
describe('PackageForm — a pristine submit', () => {
  it('answers on the first press rather than silently doing nothing', async () => {
    renderNewPackage();

    await addPackage();

    expect(requestMock).not.toHaveBeenCalled();

    const summary = await screen.findByRole('alert');
    expect(summary.textContent).toContain('fields need fixing before this can go out');
  });

  it('marks each blocking field and puts its message beside it', async () => {
    renderNewPackage();

    await addPackage();

    await screen.findByRole('alert');

    const name = screen.getByLabelText('Package name');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a package name — at least 2 characters')).toBeTruthy();

    const description = screen.getByLabelText('What it includes, in a sentence or two');
    expect(description.getAttribute('aria-invalid')).toBe('true');
    expect(
      screen.getByText('Describe what the customer gets, in at least 10 characters'),
    ).toBeTruthy();
  });

  it('moves focus to the first blocking field, described by its own message', async () => {
    renderNewPackage();

    await addPackage();

    const name = await screen.findByLabelText('Package name');
    await waitFor(() => expect(document.activeElement).toBe(name));

    const describedBy = name.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      'Enter a package name — at least 2 characters',
    );
  });

  /*
   * The description blocked the submit while nothing on screen said it was
   * required — the vendor found out by being refused. Acceptance 5.
   */
  it('marks the description required before it blocks anything', () => {
    renderNewPackage();

    expect(
      screen.getByLabelText('What it includes, in a sentence or two').hasAttribute('required'),
    ).toBe(true);
  });

  /*
   * A field that shows its own message must not also raise a toast: the vendor
   * would be told the same thing twice, in two registers.
   */
  it('does not also raise a toast for a field that carries its own message', async () => {
    renderNewPackage();

    await addPackage();
    await screen.findByRole('alert');

    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('says nothing in red before a submit is attempted', () => {
    renderNewPackage();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Package name').getAttribute('aria-invalid')).toBeNull();
  });

  it('clears a field message once the vendor corrects it', async () => {
    const user = userEvent.setup();
    renderNewPackage();

    await addPackage();
    expect(await screen.findByText('Enter a package name — at least 2 characters')).toBeTruthy();

    await user.type(screen.getByLabelText('Package name'), 'Half-day coverage');

    expect(screen.queryByText('Enter a package name — at least 2 characters')).toBeNull();
  });

  it('sends the package once every blocking field is answered', async () => {
    const user = userEvent.setup();
    requestMock.mockResolvedValue({
      id: 'p1',
      name: 'Half-day coverage',
      description: 'Four hours of documentary coverage and an online gallery.',
      priceCents: 120_000,
      priceType: 'fixed',
      durationHours: null,
      maxGuests: null,
      inclusions: [],
      isActive: true,
      displayOrder: 0,
    });
    renderNewPackage();

    await user.type(screen.getByLabelText('Package name'), 'Half-day coverage');
    await user.type(
      screen.getByLabelText('What it includes, in a sentence or two'),
      'Four hours of documentary coverage and an online gallery.',
    );
    await user.type(screen.getByLabelText('Price'), '1200');
    await addPackage();

    await waitFor(() => {
      expect(requestMock).toHaveBeenCalledWith(
        '/vendor/packages',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

/*
 * #405. The reset effect was keyed on the `servicePackage` **object**, and the
 * manager rebuilds its list on every reorder and every bookable toggle — so the
 * same package arrived as a new object, the effect reseeded the form from the
 * last saved values, and whatever the vendor had typed vanished with no prompt.
 */
describe('PackageForm — a parent that replaces its list objects', () => {
  const SAVED: WireServicePackage = {
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

  it('keeps unsaved edits when the same package arrives as a new object', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PackageForm servicePackage={SAVED} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    const name = screen.getByLabelText('Package name');
    await user.clear(name);
    await user.type(name, 'Full-day coverage');

    // What `persistOrder` and `applyActive` do: same row, new object.
    rerender(
      <PackageForm
        servicePackage={{ ...SAVED, displayOrder: 1 }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>('Package name').value).toBe('Full-day coverage');
  });

  /*
   * The other half of the same rule: choosing a different package *must* still
   * reseed. The manager does that with `key={selection}`, so the assertion is
   * on a remount — a bare `rerender` with a new id is a shape the manager
   * cannot produce, and asserting on it would be asserting on the effect this
   * ticket removed rather than on the behaviour.
   */
  it('reseeds when the manager remounts it for a different package', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PackageForm key={SAVED.id} servicePackage={SAVED} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    await user.clear(screen.getByLabelText('Package name'));
    await user.type(screen.getByLabelText('Package name'), 'Full-day coverage');

    const other = {
      ...SAVED,
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Elopement',
    };
    rerender(
      <PackageForm key={other.id} servicePackage={other} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByLabelText<HTMLInputElement>('Package name').value).toBe('Elopement');
  });
});
