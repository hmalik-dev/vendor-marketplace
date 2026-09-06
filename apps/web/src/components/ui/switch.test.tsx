import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Switch } from './switch';

afterEach(cleanup);

describe('Switch', () => {
  /*
   * #383. A switch has a transparent border and no edge of its own, so it is an
   * *unbordered control* — `03-components.md` § Inputs — and the base
   * `:focus-visible` rule in `globals.css` is that treatment exactly. Writing
   * it here is how it goes wrong: this carried shadcn's `focus-visible:border-ring
   * ring-3 ring-ring/50`, a bordered field's ring in a token the product does
   * not use, so the publish toggle focused differently from every other
   * unbordered control on the same form.
   *
   * `app/focus-ring.test.ts` owns the one declaration and
   * `e2e/focus-indicator.spec.ts` proves it paints; what this owns is that the
   * primitive keeps its hands off.
   */
  it('leaves the focus ring to the base rule rather than restating it', () => {
    render(<Switch aria-label="Visible to customers" />);

    const toggle = screen.getByRole('switch', { name: 'Visible to customers' });

    expect(toggle.className).not.toContain('focus-visible:ring-');
    expect(toggle.className).not.toContain('focus-visible:border-');
    // And it must not opt out of the rule that is now its only indicator.
    expect(toggle.getAttribute('data-focus-own')).toBeNull();
    expect(toggle.className).toContain('outline-none');
  });

  /*
   * The dead half of the same class list. `group-has-[:focus-visible]/field-label:`
   * addresses a `group/field-label` that exists nowhere in this repository —
   * shadcn ships it for a `FieldLabel` wrapper the product never adopted — so
   * both utilities compiled to rules that could never match.
   */
  it('carries no variant keyed to a group the app does not have', () => {
    render(<Switch aria-label="Visible to customers" />);

    const toggle = screen.getByRole('switch', { name: 'Visible to customers' });

    expect(toggle.className).not.toContain('field-label');
  });

  it('still renders both sizes the product asks for', () => {
    const { rerender } = render(<Switch aria-label="Small" size="sm" />);
    expect(screen.getByRole('switch', { name: 'Small' }).className).toContain(
      'data-[size=sm]:h-[14px]',
    );

    rerender(<Switch aria-label="Default" />);
    expect(screen.getByRole('switch', { name: 'Default' }).getAttribute('data-size')).toBe(
      'default',
    );
  });
});
