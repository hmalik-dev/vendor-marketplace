/**
 * How far a toast sits above the bottom of the viewport.
 *
 * The sticky submit bar on `/vendor/profile/edit` and `/vendor/packages` is
 * `py-3.5` (14px each side) around a 36px control, over a 1px top border — 65px
 * — and the toast used to land on top of it. #225 measured the confirmation
 * covering the very button that produced it, and because sonner pauses its
 * dismiss timer while the pointer rests on the toast, the button stayed
 * unreachable for 30 seconds rather than 5.
 *
 * `03-components.md` fixes the corner, not the inset, so clearing the bar keeps
 * the design and removes the trap.
 */

/**
 * The sticky submit bar at its **tallest**, not its shortest.
 *
 * One line is 1px border + 14px + a 36px control + 14px = 65px. But the bar is
 * a `flex-wrap` row whose left cell is a sentence ("2 things left before you
 * can publish — response time and payouts"), and below `lg` that sentence wraps
 * above the buttons rather than sitting beside them. Sizing to the one-line
 * case would let the two-line bar swallow the toast again at exactly the widths
 * where the bar is `sticky` rather than `static` — which is the whole span this
 * exists to cover.
 */
export const STICKY_SUBMIT_BAR_HEIGHT = 105;

/** The gap the toast keeps from whatever is beneath it. */
export const TOAST_GAP = 16;

/**
 * Passed to sonner as `offset={{ bottom }}`, never as a bare value.
 *
 * A scalar `offset` is written to all four sides — sonner's `assignOffset`
 * calls `assignAll`, setting `--offset-top/right/bottom/left` together — so
 * passing one would push every toast in the product 105px in from the right
 * edge as well, in place of the 24px default. The corner is what
 * `03-components.md` fixes; only the bottom inset is ours to move.
 */
export const TOAST_BOTTOM_OFFSET = `${STICKY_SUBMIT_BAR_HEIGHT + TOAST_GAP}px`;
