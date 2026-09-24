import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ERROR_CODES } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';
import { ConfirmAction } from './confirm-action';

const calls: { path: string; body: unknown }[] = [];
vi.mock('@/lib/use-api', () => ({
  useApi: () => async (path: string, options: { body?: unknown }) => {
    calls.push({ path, body: options.body });
    return { expiresAt: new Date('2030-01-01T12:10:00Z') };
  },
}));

afterEach(() => {
  cleanup();
  calls.length = 0;
});

/**
 * The typed hurdle on a control that stays mounted after it succeeds (VEN-391).
 *
 * The data-rights caller unmounts once the account is closed, so it cannot show
 * this: a confirm that closes the dialog itself bypasses the `onOpenChange` reset
 * a cancel goes through, and a reopened dialog would arrive already unlocked.
 */
describe('ConfirmAction with a typed confirmation', () => {
  it('starts empty again when reopened after a confirm that succeeded', async () => {
    render(
      <ConfirmAction
        trigger={<button type="button">Open</button>}
        title="Remove it?"
        description="Removes it."
        confirmLabel="Remove"
        typedConfirmation={{ phrase: 'remove me', label: 'Type remove me to confirm' }}
        onConfirm={async () => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    let dialog = screen.getByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText('Type remove me to confirm'), {
      target: { value: 'remove me' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    dialog = screen.getByRole('alertdialog');

    expect(
      (within(dialog).getByLabelText('Type remove me to confirm') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (within(dialog).getByRole('button', { name: 'Remove' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

/**
 * VEN-500: the API refuses an irreversible action with `STEP_UP_REQUIRED` until
 * the admin has entered an emailed code. The screen's browser steps cannot be
 * driven in a background lane, so this is the screen's coverage.
 */
describe('ConfirmAction when the API asks for a step-up', () => {
  const stepUpRefusal = new ApiClientError(403, ERROR_CODES.STEP_UP_REQUIRED, 'Confirm it is you');

  function open(onConfirm: () => Promise<void>): HTMLElement {
    render(
      <ConfirmAction
        trigger={<button type="button">Open</button>}
        title="Suspend?"
        description="Suspends it."
        confirmLabel="Suspend"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    return screen.getByRole('alertdialog');
  }

  it('asks for the code, then retries the press once it is accepted', async () => {
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(stepUpRefusal)
      .mockResolvedValueOnce(undefined);
    const dialog = open(onConfirm);

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    });
    expect(within(dialog).queryByLabelText('Six-digit code')).toBeNull();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Email me a code' }));
    });
    expect(calls).toEqual([{ path: '/admin/step-up/challenge', body: undefined }]);

    fireEvent.change(within(dialog).getByLabelText('Six-digit code'), {
      target: { value: '123456' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm code' }));
    });

    expect(calls[1]).toEqual({ path: '/admin/step-up/verify', body: { code: '123456' } });
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('holds the main confirm off while the code step is showing', async () => {
    const dialog = open(vi.fn<() => Promise<void>>().mockRejectedValue(stepUpRefusal));

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    });

    expect(
      (within(dialog).getByRole('button', { name: 'Suspend' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('keeps the code button off until six digits are typed', async () => {
    const onConfirm = vi.fn<() => Promise<void>>().mockRejectedValue(stepUpRefusal);
    const dialog = open(onConfirm);

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Email me a code' }));
    });
    fireEvent.change(within(dialog).getByLabelText('Six-digit code'), {
      target: { value: '12345' },
    });

    expect(
      (within(dialog).getByRole('button', { name: 'Confirm code' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows no code step for any other refusal', async () => {
    const dialog = open(
      vi
        .fn<() => Promise<void>>()
        .mockRejectedValue(new ApiClientError(409, ERROR_CODES.CONFLICT, 'Already suspended')),
    );

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend' }));
    });

    expect(within(dialog).getByRole('alert').textContent).toBe('Already suspended');
    expect(within(dialog).queryByRole('button', { name: 'Email me a code' })).toBeNull();
  });
});

/**
 * VEN-682: `busy` disables the confirm only after React re-renders, so two clicks
 * inside one act reach `onConfirm` twice. The second publish answered 409 and
 * left the E2E fixture vendor unpublished.
 */
describe('ConfirmAction confirmed twice in quick succession', () => {
  function openDialog(onConfirm: () => Promise<void>): HTMLElement {
    render(
      <ConfirmAction
        trigger={<button type="button">Open</button>}
        title="Unpublish?"
        description="Unpublishes it."
        confirmLabel="Unpublish profile"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    return screen.getByRole('alertdialog');
  }

  it('sends one request, however many clicks land before the re-render', async () => {
    let release: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const dialog = openDialog(onConfirm);
    const confirmButton = within(dialog).getByRole('button', { name: 'Unpublish profile' });

    await act(async () => {
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('accepts a retry after the first attempt failed', async () => {
    const onConfirm = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const dialog = openDialog(onConfirm);

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Unpublish profile' }));
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Unpublish profile' }));
    });

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
