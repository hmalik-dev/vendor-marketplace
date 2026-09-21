import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Frame `08/09/11 shared`, Access axis.
 *
 * The law is `design/design-plan/03-components.md` § Inputs, restated in
 * `04-laws.md`: **three** focus treatments chosen by what the element already
 * has, never mixed. The base rule in `globals.css` is the *unbordered control*
 * one — `ring-2 ring-clay-400 ring-offset-2 ring-offset-stone-50` — and
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
const RING = ['ring-2', 'ring-clay-400', 'ring-offset-2', 'ring-offset-stone-50'] as const;

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
   * #195 fixed the auth form's controls by out-ranking a provider's injected
   * stylesheet. The form is the app's own now — `Input` and `Button` carry the
   * product's ring — so nothing needs out-ranking, and the overrides that did
   * are gone. A provider selector coming back would be the return of that
   * fight.
   */
  it('carries no provider-styling override for the auth form', () => {
    expect(globalsCss).not.toMatch(/\.cl-|cl(?:)erk/i);
    expect(globalsCss).not.toContain('.cl-formFieldInput');
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
    expect(form).toContain('has-focus-visible:ring-clay-400');
  });
});
