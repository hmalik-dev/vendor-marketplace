import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useModalSheet } from './use-modal-sheet';

afterEach(cleanup);

/** A trigger and a panel with three focusables, the shape of the Filters sheet. */
function Sheet(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useModalSheet({ open, onClose: () => setOpen(false), panel, trigger });

  return (
    <>
      <button ref={trigger} type="button" onClick={() => setOpen(true)}>
        Filters
      </button>
      <button type="button">Outside before</button>
      <div ref={panel} {...(open ? { role: 'dialog', 'aria-modal': true } : {})} hidden={!open}>
        <button type="button">First</button>
        <button type="button">Middle</button>
        <button type="button">Last</button>
      </div>
    </>
  );
}

describe('useModalSheet', () => {
  /*
   * The three things `04-laws.md` requires of a modal, and the three the
   * Filters sheet had none of: it carried no role, nothing trapped focus, and
   * Escape dismissed it at no width (#73 law 4).
   */
  it('moves focus into the panel when it opens', async () => {
    render(<Sheet />);

    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
  });

  it('closes on Escape', async () => {
    render(<Sheet />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('dialog')).toBeDefined();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('returns focus to the trigger when it closes', async () => {
    render(<Sheet />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(trigger);

    await userEvent.keyboard('{Escape}');

    expect(document.activeElement).toBe(trigger);
  });

  it('wraps Tab from the last focusable back to the first', async () => {
    render(<Sheet />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));

    screen.getByRole('button', { name: 'Last' }).focus();
    await userEvent.tab();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
  });

  it('wraps Shift+Tab from the first focusable back to the last', async () => {
    render(<Sheet />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));

    screen.getByRole('button', { name: 'First' }).focus();
    await userEvent.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }));
  });

  /*
   * The panel's own chips are Radix Popovers, portalled to the end of `<body>`.
   * A trap that reads `panel.contains(activeElement)` sees an open popover as
   * OUTSIDE and yanks focus back to the top of the sheet on every Tab, which
   * made the maximum-price slider and every tag checkbox after the first
   * unreachable — a keyboard regression shipped by an accessibility fix.
   */
  it('leaves Tab alone while focus is in a portalled Radix layer', async () => {
    render(<Sheet />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));

    const portal = document.createElement('div');
    portal.setAttribute('data-radix-popper-content-wrapper', '');
    portal.innerHTML = '<button type="button">In popover</button>';
    document.body.append(portal);

    const inPopover = portal.querySelector('button');
    inPopover?.focus();
    await userEvent.tab();

    // Not dragged back to the sheet's first control.
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'First' }));
    portal.remove();
  });

  /* One Escape dismisses the innermost layer, not the popover AND the sheet. */
  it('leaves Escape to the portalled layer that owns it', async () => {
    render(<Sheet />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));

    const portal = document.createElement('div');
    portal.setAttribute('data-radix-popper-content-wrapper', '');
    portal.innerHTML = '<button type="button">In popover</button>';
    document.body.append(portal);
    portal.querySelector('button')?.focus();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeNull();
    portal.remove();
  });

  /* Nothing is trapped, listened for, or moved while the sheet is the desktop bar. */
  it('does nothing at all while closed', async () => {
    render(<Sheet />);
    const outside = screen.getByRole('button', { name: 'Outside before' });
    outside.focus();

    await userEvent.keyboard('{Escape}');

    expect(document.activeElement).toBe(outside);
  });
});
