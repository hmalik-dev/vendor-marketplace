import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AdminOperatorRow } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

const calls: { path: string; method?: string; body?: unknown }[] = [];

vi.mock('@/lib/use-api', () => ({
  useApi: () => async (path: string, options: { method?: string; body?: unknown }) => {
    calls.push({ path, method: options.method, body: options.body });
    return {};
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { OperatorsPanel } = await import('./operators-panel');

const FOUNDER: AdminOperatorRow = {
  userId: '11111111-1111-4111-8111-111111111111',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  isBanned: false,
  since: '2026-09-01T08:00:00.000Z',
  grantedAt: null,
  grantedByName: null,
  revocable: false,
};
const GRANTED: AdminOperatorRow = {
  userId: '22222222-2222-4222-8222-222222222222',
  firstName: 'Grace',
  lastName: 'Hopper',
  email: 'grace@example.com',
  isBanned: false,
  since: '2026-09-14T09:05:00.000Z',
  grantedAt: '2026-09-14T09:05:00.000Z',
  grantedByName: 'Ada Lovelace',
  revocable: true,
};

afterEach(() => {
  cleanup();
  calls.length = 0;
});

describe('OperatorsPanel', () => {
  it('names who granted each operator and offers Revoke only where a role can be restored', () => {
    render(<OperatorsPanel operators={[FOUNDER, GRANTED]} />);

    expect(screen.getByText('Set up before launch')).toBeDefined();
    expect(screen.getByText('Sep 14, 2026, 09:05 UTC')).toBeDefined();
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /operator access from ada@example.com/ }),
    ).toBeNull();
    expect(
      screen.getAllByRole('button', { name: 'Remove operator access from grace@example.com' }),
    ).not.toHaveLength(0);
  });

  it('keeps Grant disabled until the address is one, then posts it after the confirm', async () => {
    render(<OperatorsPanel operators={[FOUNDER]} />);
    const grant = screen.getByRole('button', { name: 'Grant operator access' });
    const input = screen.getByLabelText('Give operator access to an existing account');

    expect((grant as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'not an address' } });
    expect((grant as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: ' new@example.com ' } });
    fireEvent.click(grant);
    fireEvent.click(await screen.findByRole('button', { name: 'Grant access' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({
      path: '/admin/operators',
      method: 'POST',
      body: { email: 'new@example.com' },
    });
  });

  it('revokes by user id after the confirm', async () => {
    render(<OperatorsPanel operators={[FOUNDER, GRANTED]} />);

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Remove operator access from grace@example.com' })[0]!,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke access' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({
      path: `/admin/operators/${GRANTED.userId}`,
      method: 'DELETE',
    });
  });
});
