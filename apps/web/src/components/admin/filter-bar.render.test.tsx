import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterSelect } from './filter-bar';

const push = vi.fn<(href: string) => void>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'closed', label: 'Closed' },
] as const;

afterEach(cleanup);

/**
 * The clearing choice, and what it is allowed to claim (#450).
 *
 * `Any <label>` is right wherever the absence of a parameter really is "no
 * filter". On `/admin/customers` it is not: absence means **live accounts**,
 * and `Closed` is one of the values in the same list — so a choice reading "Any
 * status" would take an operator looking at closed accounts back to a set those
 * accounts are not in, which is the defect #450 exists to fix.
 *
 * Rendered open rather than clicked open: the panel mounts on `open`, and
 * driving Radix's trigger through jsdom's pointer emulation would be asserting
 * on the harness. `open` is a controlled prop here, so passing it is the
 * component's own contract, not a shortcut past it.
 */
describe('FilterSelect', () => {
  function renderOpen(props: Partial<Parameters<typeof FilterSelect>[0]> = {}): void {
    render(
      <FilterSelect
        action="/admin/customers"
        carried={{}}
        name="status"
        label="Status"
        options={OPTIONS}
        value=""
        {...props}
      />,
    );
    /*
     * The panel mounts on `open`, which `FilterSelect` owns internally, so the
     * only way in is the trigger. `act` because the click is a state update.
     */
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    });
  }

  it('defaults the clearing choice to `Any <label>`', () => {
    renderOpen();

    expect(screen.getByText('Any status')).toBeDefined();
  });

  it('names the set the clearing choice lands on when asked to', () => {
    renderOpen({ anyLabel: 'Live accounts' });

    expect(screen.getByText('Live accounts')).toBeDefined();
    /*
     * The wrong claim must be gone, not merely joined by a right one — a
     * fixture that only asserted the new label would pass with both rendered.
     */
    expect(screen.queryByText('Any status')).toBeNull();
  });

  it('offers no clearing choice at all where a surface suppresses it', () => {
    renderOpen({ allowAny: false, anyLabel: 'Live accounts' });

    expect(screen.queryByText('Any status')).toBeNull();
    expect(screen.queryByText('Live accounts')).toBeNull();
    /* The real options are still there, so the suppression is narrow. */
    expect(screen.getByText('Closed')).toBeDefined();
  });
});
