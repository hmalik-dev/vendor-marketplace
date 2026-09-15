import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AdminCategoryRow } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const { CategoryTable } = await import('./category-table');

const row = (id: string, name: string, overrides: Partial<AdminCategoryRow> = {}) => ({
  id,
  name,
  slug: name.toLowerCase(),
  description: null,
  icon: null,
  displayOrder: 0,
  isActive: true,
  vendorCount: 0,
  ...overrides,
});

const PHOTOGRAPHY = row('11111111-1111-4111-8111-111111111111', 'Photography', { vendorCount: 3 });
const CATERING = row('22222222-2222-4222-8222-222222222222', 'Catering', { isActive: false });
const DECOR = row('33333333-3333-4333-8333-333333333333', 'Decor');
const ALL = [PHOTOGRAPHY, CATERING, DECOR];

/* `DataTable` draws the grid and the card list until hydration, so a control can exist twice. */
const button = (name: string): HTMLButtonElement =>
  screen.getAllByRole('button', { name })[0] as HTMLButtonElement;

afterEach(() => {
  cleanup();
  calls.length = 0;
  refresh.mockClear();
});

describe('CategoryTable', () => {
  it('cannot move the first row up or the last row down', () => {
    render(<CategoryTable categories={ALL} />);

    expect(button('Move Photography up').disabled).toBe(true);
    expect(button('Move Decor down').disabled).toBe(true);
    expect(button('Move Catering up').disabled).toBe(false);
  });

  it('sends the whole order with the row swapped, then refreshes', async () => {
    render(<CategoryTable categories={ALL} />);

    await act(async () => {
      fireEvent.click(button('Move Decor up'));
    });

    expect(calls).toEqual([
      {
        path: '/admin/categories/order',
        method: 'PUT',
        body: {
          categoryIds: [PHOTOGRAPHY.id, DECOR.id, CATERING.id],
          basedOnCategoryIds: [PHOTOGRAPHY.id, CATERING.id, DECOR.id],
        },
      },
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('reactivates a hidden category without a dialog', async () => {
    render(<CategoryTable categories={ALL} />);

    expect(screen.getAllByText('Hidden').length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(button('Reactivate'));
    });

    expect(calls).toEqual([
      { path: `/admin/categories/${CATERING.id}`, method: 'PUT', body: { isActive: true } },
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('says a failed move did not save and does not refresh', async () => {
    render(<CategoryTable categories={ALL} />);
    failNext = true;

    await act(async () => {
      fireEvent.click(button('Move Photography down'));
    });

    expect(screen.getByRole('alert').textContent).toBe('That order did not save.');
    expect(refresh).not.toHaveBeenCalled();
  });
});
