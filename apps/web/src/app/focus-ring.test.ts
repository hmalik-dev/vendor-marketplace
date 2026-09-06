import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Frame `08/09/11 shared`, Access axis.
 *
 * The law is `design/design-plan/03-components.md` § Inputs, restated in
 * `04-laws.md`: **three** focus treatments chosen by what the element already
 * has, never mixed. The base rule in `globals.css` is the *unbordered control*
 * one — `ring-2 ring-clay-400/40 ring-offset-2 ring-offset-stone-50` — and
 * both files state `/40`. It was `/30` here and in every hand-rolled copy of it
 * until #383; the two plan files already agreed, and the code was the outlier,
 * so nothing in the plan moved.
 *
 * The frames are static and draw no focus state, so the plan is the contract
 * here rather than the `.dc.html` bundle.
 *
 * This is a source guard, not the real gate. The parity pass that found this
 * had to tab to each control with a real keyboard and read the rendered ring,
 * because a correct *computed* value is exactly what was passing while nothing
 * appeared on screen. There is no Playwright harness in the repo yet — that is
 * ticket #14 — so the browser check stays manual for now.
 */
const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** The unbordered treatment: the four utilities the law names, in its order. */
const RING = ['ring-2', 'ring-clay-400/40', 'ring-offset-2', 'ring-offset-stone-50'] as const;

/** The bordered-field treatment. No offset — a field has an edge already. */
const FIELD = ['border-clay-400', 'ring-3', 'ring-clay-400/15'] as const;

function ruleFor(selector: string): string {
  const match = globalsCss.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  expect(match).not.toBeNull();

  return match?.[1] ?? '';
}

describe('the product’s focus ring reaches every control', () => {
  it('declares the ring once, for anything focusable', () => {
    const rule = ruleFor(':focus-visible:not\\(\\[data-focus-own\\]\\)');

    for (const utility of RING) {
      expect(rule).toContain(utility);
    }

    // Chrome's blue must not survive alongside it.
    expect(rule).toContain('outline-none');
  });

  /*
   * #383, and the whole mechanism of it. `ring-*`, `inset-ring-*`,
   * `ring-offset-*` and `outline` are four different properties, so a component
   * that overrode one of them kept the rest of this rule and painted two, three
   * or four concentric indicators. `:not([data-focus-own])` is what lets a
   * component take the rule off entirely, which is the only override that
   * works.
   */
  it('lets a control that owns its indicator take the base rule off', () => {
    expect(globalsCss).toContain(':focus-visible:not([data-focus-own])');
    // And a plain `:focus-visible { … }` must not survive beside it, or the
    // escape hatch is decorative.
    expect(globalsCss).not.toMatch(/^\s*:focus-visible \{/m);
  });

  /*
   * Opting out of the ring is not opting into Chrome's blue. Every treatment
   * ends at `outline-none` unless the component restores an outline itself.
   */
  it('still suppresses the browser outline on a control that opts out', () => {
    expect(ruleFor('\\[data-focus-own\\]:focus-visible')).toContain('outline-none');
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
  it('restates the treatments for the three controls Clerk styles itself', () => {
    const start = globalsCss.indexOf(
      '[data-auth-screen] .cl-formButtonPrimary.cl-formButtonPrimary:focus-visible',
    );

    expect(start).toBeGreaterThan(-1);

    const selectors = globalsCss.slice(start, start + 280);

    /*
     * Each class is repeated to reach (0,4,0). Clerk's submit rule ties at
     * (0,3,0) and, being injected at runtime, wins every tie on source order.
     */
    for (const control of [
      '.cl-formButtonPrimary.cl-formButtonPrimary:focus-visible',
      '.cl-formFieldInputShowPasswordButton.cl-formFieldInputShowPasswordButton:focus-visible',
    ]) {
      expect(selectors).toContain(control);
    }

    /*
     * The two buttons are unbordered controls and take the offset ring; the
     * text field is a bordered field and takes the tight one with no offset.
     * They shared a block, at the unbordered value, until #383 — which is the
     * same "one treatment for everything" the base rule was carrying.
     */
    const buttons = globalsCss.slice(start).match(/\{([^}]*)\}/)?.[1] ?? '';

    for (const utility of RING) {
      expect(buttons).toContain(utility);
    }

    const rule = ruleFor(
      '\\[data-auth-screen\\] \\.cl-formFieldInput\\.cl-formFieldInput:focus-visible',
    );

    for (const utility of FIELD) {
      expect(rule).toContain(utility);
    }

    /*
     * And it must zero the offset rather than merely not set one. Clerk's nodes
     * cannot carry `data-focus-own`, so the base rule still reaches them and
     * `ring-offset-*` is a separate property from `ring-*`: without this the
     * field kept the unbordered treatment's 2px band under the bordered
     * treatment's ring.
     */
    expect(rule).toContain('ring-offset-0');
    expect(buttons).toContain('outline-none');
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
    // And at the law's opacity, like every other copy of this treatment.
    expect(form).toContain('has-focus-visible:ring-clay-400/40');
  });

  it('names tokens rather than hexes, so the palette stays one source', () => {
    const rule = ruleFor('\\.cl-userButtonTrigger:focus-visible');

    // #B4552F is clay-400 and #F8F5EF is stone-50; either appearing here would
    // be the second source of truth `layout.tsx` warns about.
    expect(rule).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});
