/**
 * The product's focus indicators, written once (#383).
 *
 * `design/design-plan/03-components.md` § Inputs specifies **three** treatments
 * chosen by what the element already has, and `04-laws.md` restates them. They
 * are never mixed, and an element gets exactly one:
 *
 * | Element                              | Treatment                                      |
 * | ------------------------------------ | ---------------------------------------------- |
 * | Standalone bordered field            | `border-clay-400` + `ring-3 ring-clay-400/15`  |
 * | Segment inside a joined bar or panel | `bg-stone-200` fill + clay label, nothing else |
 * | Unbordered control                   | `ring-2 ring-clay-400/40 ring-offset-2`        |
 *
 * **The unbordered one has no constant here on purpose** — it is the base rule
 * in `app/globals.css`, so an unbordered control writes nothing at all and
 * cannot get it wrong. The other two are opt-ins, and opting in means two
 * things together: one of these constants, and `data-focus-own` on the same
 * element so the base rule steps aside. Neither is any use without the other,
 * because the base rule's `ring-offset-*` is a different custom property from
 * its `ring-*` and survives a component that overrides only the latter — which
 * is how a plain text input came to render three concentric edges.
 *
 * `components/focus-ring-guard.test.ts` fails a file that declares one without
 * the other.
 */

/**
 * A standalone bordered field: darken the edge it already has, and hug it with
 * a tight ring. **No offset band** — a detached ring on a field that is already
 * outlined reads as browser chrome rather than as the product.
 */
export const FIELD_FOCUS =
  'focus-visible:border-clay-400 focus-visible:ring-3 focus-visible:ring-clay-400/15';

/*
 * A wrapper that rings on behalf of a control inside it writes the `has-[…]`
 * variant literally at its own call site rather than composing it here.
 * Tailwind scans source text for finished class names, so a template literal
 * that builds one at runtime generates no CSS at all.
 */

/**
 * A segment inside a joined bar or panel: a fill, and nothing else. No border,
 * no edge, no outline — an outward ring around one segment of a pill breaks
 * past the pill's own edge and reads as a second, misaligned box.
 */
export const SEGMENT_FOCUS = 'has-[:focus-visible]:bg-stone-200';
