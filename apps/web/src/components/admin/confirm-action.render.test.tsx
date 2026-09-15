import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmAction } from './confirm-action';

afterEach(cleanup);

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
