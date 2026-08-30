import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Frame `08/09/11 shared`, Access axis.
 *
 * The law is one line of `design/design-plan/04-laws.md`: every interactive
 * element takes `ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50`
 * on focus. The frames are static and draw no focus state, so the plan is the
 * contract here rather than the `.dc.html` bundle.
 *
 * This is a source guard, not the real gate. The parity pass that found this
 * had to tab to each control with a real keyboard and read the rendered ring,
 * because a correct *computed* value is exactly what was passing while nothing
 * appeared on screen. There is no Playwright harness in the repo yet — that is
 * ticket #14 — so the browser check stays manual for now.
 */
const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** The four utilities the law names, in the order it names them. */
const RING = ['ring-2', 'ring-clay-400/30', 'ring-offset-2', 'ring-offset-stone-50'] as const;

function ruleFor(selector: string): string {
  const match = globalsCss.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  expect(match).not.toBeNull();

  return match?.[1] ?? '';
}

describe('the product’s focus ring reaches every control', () => {
  it('declares the ring once, for anything focusable', () => {
    const rule = ruleFor(':focus-visible');

    for (const utility of RING) {
      expect(rule).toContain(utility);
    }

    // Chrome's blue must not survive alongside it.
    expect(rule).toContain('outline-none');
  });

  /*
   * Clerk's user button is the one control the rule above cannot reach: Clerk
   * ships a box-shadow of its own and wins the cascade, so the trigger drew a
   * 4px clay ring at 50% with no offset layer at all.
   */
  it('restates the ring for Clerk’s user button, which outranks the base rule', () => {
    const rule = ruleFor('\\.cl-userButtonTrigger:focus-visible');

    for (const utility of RING) {
      expect(rule).toContain(utility);
    }

    expect(rule).toContain('outline-none');
  });

  /*
   * Load-bearing, and the reason two earlier attempts failed: Clerk injects
   * its styles into a later cascade layer, and a later layer beats an earlier
   * one whatever the selector's specificity. Putting this back inside
   * `@layer base` silently restores the bug.
   */
  it('keeps Clerk’s overrides outside @layer base, where they can win', () => {
    const base = globalsCss.match(/@layer base \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(base).not.toBe('');
    expect(base).not.toContain('cl-userButtonTrigger');
    expect(globalsCss).toContain('.cl-userButtonTrigger:focus-visible');
  });

  /*
   * #195. The auth form's three Clerk-styled controls had the same defect as
   * the user button — a 4px clay at 50% with no offset layer. The nodes Clerk
   * does *not* style itself (its footer link, its logo link) already take the
   * base rule correctly, which is what proves the layer is the cause rather
   * than the selector.
   */
  it('restates the ring for the three controls Clerk styles itself', () => {
    /*
     * One grouped rule, so it is read as one: `ruleFor` matches a single
     * selector and these three share a declaration block on purpose.
     */
    const match = globalsCss.match(
      /\[data-auth-screen\] \.cl-formFieldInput\.cl-formFieldInput:focus-visible[^{]*\{([^}]*)\}/,
    );

    expect(match).not.toBeNull();

    const rule = match?.[1] ?? '';
    const start = globalsCss.indexOf(
      '[data-auth-screen] .cl-formFieldInput.cl-formFieldInput:focus-visible',
    );
    const selectors = globalsCss.slice(start, start + 340);

    /*
     * Each class is repeated to reach (0,4,0). Clerk's submit rule ties at
     * (0,3,0) and, being injected at runtime, wins every tie on source order.
     */
    for (const control of [
      '.cl-formFieldInput.cl-formFieldInput:focus-visible',
      '.cl-formButtonPrimary.cl-formButtonPrimary:focus-visible',
      '.cl-formFieldInputShowPasswordButton.cl-formFieldInputShowPasswordButton:focus-visible',
    ]) {
      expect(selectors).toContain(control);
    }

    for (const utility of RING) {
      expect(rule).toContain(utility);
    }

    expect(rule).toContain('outline-none');
    /*
     * And it must NOT reset `box-shadow`. Tailwind's `ring-*` utilities are
     * themselves a box-shadow, so a `box-shadow: none` after them removes the
     * product's ring too — the browser check for this fix read `none` on a
     * focused input before the reset came out.
     */
    expect(rule).not.toContain('box-shadow: none');
  });

  it('keeps the auth-form overrides outside @layer base too', () => {
    const base = globalsCss.match(/@layer base \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(base).not.toContain('cl-formFieldInput');
    expect(globalsCss).toContain(
      '[data-auth-screen] .cl-formFieldInput.cl-formFieldInput:focus-visible',
    );
  });

  /*
   * #195. The offset *colour* is as load-bearing as the offset: without it the
   * band draws Tailwind's default white, and a white halo on the panel's
   * stone-50 reads as a rendering artefact rather than a focus state.
   */
  it('gives the sign-up role cards the stone-50 offset, not the default white', () => {
    const form = readFileSync(join(process.cwd(), 'src/components/auth/sign-up-form.tsx'), 'utf8');

    expect(form).toContain('has-focus-visible:ring-offset-stone-50');
  });

  it('names tokens rather than hexes, so the palette stays one source', () => {
    const rule = ruleFor('\\.cl-userButtonTrigger:focus-visible');

    // #B4552F is clay-400 and #F8F5EF is stone-50; either appearing here would
    // be the second source of truth `layout.tsx` warns about.
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
