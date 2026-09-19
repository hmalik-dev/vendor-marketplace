import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MAX_NAME_LENGTH } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminTagRow } from '@/lib/wire-schemas';

const calls: { path: string; method?: string; body?: unknown }[] = [];
const refresh = vi.fn();
let failNext = false;

vi.mock('@/lib/use-api', () => ({
  useApi: () => async (path: string, options: { method?: string; body?: unknown }) => {
    calls.push({ path, method: options.method, body: options.body });
    if (failNext) {
      failNext = false;
      throw new Error('network down');
    }
    return {};
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { TagTable } = await import('./tag-table');

const tag = (overrides: Partial<WireAdminTagRow>): WireAdminTagRow => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Halal',
  slug: 'dietary-halal',
  category: 'dietary',
  displayOrder: 1,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  vendorCount: 2,
  ...overrides,
});

/* `DataTable` draws the grid and the card list until hydration, so a control can exist twice. */
const button = (name: string): HTMLButtonElement =>
  screen.getAllByRole('button', { name })[0] as HTMLButtonElement;

afterEach(() => {
  cleanup();
  calls.length = 0;
  refresh.mockClear();
});

describe('TagTable', () => {
  it('tells the operator when Reactivate fails, and does not refresh', async () => {
    const hidden = tag({ isActive: false });
    render(<TagTable tags={[hidden]} />);
    failNext = true;

    await act(async () => {
      fireEvent.click(button('Reactivate'));
    });

    expect(screen.getAllByRole('alert')[0]!.textContent).toBe(
      'That did not reach us. Check your connection and try again.',
    );
    expect(calls).toEqual([
      { path: `/admin/tags/${hidden.id}`, method: 'PUT', body: { isActive: true } },
    ]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reactivates and refreshes when the call succeeds', async () => {
    render(<TagTable tags={[tag({ isActive: false })]} />);

    await act(async () => {
      fireEvent.click(button('Reactivate'));
    });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('caps the rename input at the length the API accepts', () => {
    render(<TagTable tags={[tag({})]} />);

    fireEvent.click(button('Halal'));

    const input = screen.getAllByRole('textbox', { name: 'Rename Halal' })[0]!;
    expect(input.getAttribute('maxlength')).toBe(String(MAX_NAME_LENGTH));
  });
});
