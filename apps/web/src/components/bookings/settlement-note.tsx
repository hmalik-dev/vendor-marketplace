export interface SettlementNoteProps {
  /** A line from `cancellationNarrative`; `null` when no money ever moved. */
  money: string | null;
}

/**
 * What the money did, on its own line (#415).
 *
 * Both sides of a cancelled booking render this, and it is one component for
 * the same reason `cancellationNarrative` is one module: a refund figure that
 * the customer's screen and the vendor's present differently is the shape this
 * ticket exists to end. A figure buried in a paragraph is how it went unsaid
 * the first time.
 */
export function SettlementNote({ money }: SettlementNoteProps): React.ReactElement | null {
  if (!money) {
    return null;
  }

  return (
    <p className="rounded-[10px] bg-stone-50 px-3.5 py-3 text-sm leading-[1.6] text-stone-700">
      {money}
    </p>
  );
}
