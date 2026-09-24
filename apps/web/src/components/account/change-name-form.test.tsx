import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();
const assign = vi.fn();
vi.mock('@/lib/use-api', () => ({ useApi: () => call }));

const { ChangeNameForm } = await import('./change-name-form');

beforeEach(() => {
  assign.mockReset();
  call.mockReset().mockResolvedValue({});
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('Enter your first and last name.');
  });

  it('saves the trimmed name, then loads the list afresh so the header follows', async () => {
    await submitWith('Ada', ' Byron ');

    expect(call).toHaveBeenCalledExactlyOnceWith(
      '/users/me',
      expect.objectContaining({ method: 'PUT', body: { firstName: 'Ada', lastName: 'Byron' } }),
    );
    expect(assign).toHaveBeenCalledExactlyOnceWith('/account/settings?saved=name');
  });

  it('stays on the page and says so when the save fails', async () => {
    call.mockRejectedValue(new Error('boom'));

    await submitWith('Ada', 'Byron');

    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('That did not save');
  });
});
