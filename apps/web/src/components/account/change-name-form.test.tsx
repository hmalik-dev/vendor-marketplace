import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
const push = vi.fn();
const call = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }));
vi.mock('@/lib/use-api', () => ({ useApi: () => call }));

const { ChangeNameForm } = await import('./change-name-form');

beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  call.mockReset().mockResolvedValue({});
});

afterEach(cleanup);

async function submitWith(first: string, last: string): Promise<void> {
  const user = userEvent.setup();
  render(<ChangeNameForm firstName="Ada" lastName="Lovelace" />);
  const firstField = screen.getByLabelText('First name');
  const lastField = screen.getByLabelText('Last name');
  await user.clear(firstField);
  await user.clear(lastField);
  if (first) await user.type(firstField, first);
  if (last) await user.type(lastField, last);
  await user.click(screen.getByRole('button', { name: 'Save name' }));
}

describe('ChangeNameForm (VEN-703)', () => {
  it('starts from the name on file', () => {
    render(<ChangeNameForm firstName="Ada" lastName="Lovelace" />);

    expect(screen.getByLabelText<HTMLInputElement>('First name').value).toBe('Ada');
    expect(screen.getByLabelText<HTMLInputElement>('Last name').value).toBe('Lovelace');
  });

  it.each([
    ['a blank first name', '', 'Lovelace'],
    ['a blank last name', 'Ada', ''],
    ['a whitespace-only last name', 'Ada', '   '],
  ])('refuses %s before any request', async (_name, first, last) => {
    await submitWith(first, last);

    expect(call).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Enter your first and last name.');
  });

  it('saves the trimmed name, returns to the list and refreshes the header', async () => {
    await submitWith('Ada', ' Byron ');

    expect(call).toHaveBeenCalledExactlyOnceWith(
      '/users/me',
      expect.objectContaining({ method: 'PUT', body: { firstName: 'Ada', lastName: 'Byron' } }),
    );
    expect(push).toHaveBeenCalledExactlyOnceWith('/account/settings?saved=name');
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('stays on the page and says so when the save fails', async () => {
    call.mockRejectedValue(new Error('boom'));

    await submitWith('Ada', 'Byron');

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('That did not save');
  });
});
