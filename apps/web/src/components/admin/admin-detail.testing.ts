/**
 * Everything a person can operate, by what it is rather than by what it says.
 *
 * Pattern B rule 4 — nothing interactive inside read-only data — is asserted by
 * querying a card for any of these, so a control added next month fails the
 * guard without anybody having to name it first.
 */
export const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, [contenteditable=""], [contenteditable="true"], [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="tab"]';

/** The band title of every read-only card in `root`, with the controls found inside each. */
export function interactiveInsideReadOnlyCards(root: ParentNode): Record<string, number> {
  return Object.fromEntries(
    [...root.querySelectorAll<HTMLElement>('[data-admin-card][data-read-only]')].map((card) => [
      card.querySelector('h2')?.textContent ?? '(untitled)',
      card.querySelectorAll(INTERACTIVE).length,
    ]),
  );
}
