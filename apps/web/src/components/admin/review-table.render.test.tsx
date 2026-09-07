import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminReviewRow } from '@/lib/wire-schemas';

vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { ReviewTable } = await import('./review-table');

afterEach(cleanup);

function reviewRow(overrides: Partial<WireAdminReviewRow> = {}): WireAdminReviewRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    rating: 2,
    title: 'Late and unapologetic',
    content: 'They arrived two hours after the ceremony started.',
    type: 'customer_to_vendor',
    authorName: 'Dana R.',
    vendorName: 'Fernbank Studio',
    vendorSlug: 'fernbank-studio',
    isPublic: true,
    createdAt: new Date('2026-05-04T00:00:00Z'),
    ...overrides,
  };
}

/**
 * #435 — hiding a review is reversible, and an operator can only reverse a state
 * they can see.
 *
 * Every public read now filters `is_public`, which makes the console the one
 * surface where a hidden review still appears at all. If the row does not say
 * it is hidden, "Unhide review" names something invisible and the action reads
 * as a second way to hide it.
 */
describe('ReviewTable', () => {
  it('marks the hidden review and only the hidden one', () => {
    render(
      <ReviewTable
        filtered={false}
        rows={[
          reviewRow(),
          reviewRow({
            id: '22222222-2222-4222-8222-222222222222',
            title: 'A review an operator took down',
            isPublic: false,
          }),
        ]}
      />,
    );

    /*
     * Two, not four. `DataTable` renders every row twice — the grid from `md`
     * up and a card list below it — so one marked row out of two is two pills,
     * and marking both would be four. The assertion is the pairing, not the
     * presence of a pill.
     */
    expect(screen.getAllByText('Hidden')).toHaveLength(2);
    expect(screen.getAllByText('A review an operator took down')).toHaveLength(2);
    expect(screen.getAllByText('Late and unapologetic')).toHaveLength(2);
  });

  /*
   * The overflow control names its row. Two moderation actions now live behind
   * one glyph, so a `···` labelled only "Delete the review" — which is what it
   * said before this ticket — would announce the wrong action to a screen reader
   * and describe only one of the two.
   */
  it('gives each row an overflow menu named for the review it acts on', () => {
    render(<ReviewTable filtered={false} rows={[reviewRow()]} />);

    // Two: the grid rendering and the card rendering of the same row.
    expect(
      screen.getAllByRole('button', {
        name: 'Actions for the review of Fernbank Studio by Dana R.',
      }),
    ).toHaveLength(2);
  });

  /** Opens the first `···` and returns the menu item labels, in order. */
  function menuLabelsFor(row: WireAdminReviewRow): string[] {
    render(<ReviewTable filtered={false} rows={[row]} />);
    const [trigger] = screen.getAllByRole('button', { name: /^Actions for the review/ });
    // Radix opens a `DropdownMenu` from the keyboard as well as the pointer, and
    // jsdom has no PointerEvent — so the keyboard path is the one that works here.
    fireEvent.keyDown(trigger!, { key: 'Enter' });

    return screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
  }

  /*
   * The label is the operator's only cue for which direction they are about to
   * move a review, and it is one ternary. Swapping it passed every other test
   * in this file, because none of them opened the menu.
   */
  it('offers Hide on a visible review and Unhide on a hidden one', () => {
    expect(menuLabelsFor(reviewRow())).toEqual(['Hide review', 'Delete review']);
    cleanup();
    expect(menuLabelsFor(reviewRow({ isPublic: false }))).toEqual([
      'Unhide review',
      'Delete review',
    ]);
  });

  /**
   * **A vendor's private note about a customer is not a hidden review.**
   *
   * `is_public` means "a moderator hid this" in one direction and "the author
   * keeps this to themselves" in the other. Offering Unhide over the second
   * would publish a note to every other vendor, and `seed-demo` writes every
   * one of them private — so this was a single click away on any demo database.
   * Deletion still applies; the visibility lever does not.
   */
  it('offers no visibility lever on a vendor’s private note, only deletion', () => {
    expect(menuLabelsFor(reviewRow({ type: 'vendor_to_customer', isPublic: false }))).toEqual([
      'Delete review',
    ]);
  });

  it('calls a private note private, not hidden', () => {
    render(
      <ReviewTable
        filtered={false}
        rows={[reviewRow({ type: 'vendor_to_customer', isPublic: false })]}
      />,
    );

    expect(screen.getAllByText('Private')).toHaveLength(2);
    expect(screen.queryByText('Hidden')).toBeNull();
  });

  /*
   * The dialog says the same word as the menu item that opened it.
   *
   * Browser verification found the unhide direction drifting — the menu item
   * read "Unhide review" and its confirm button "Show review". Cosmetic on its
   * own, but this ticket's whole risk is an operator misreading which action
   * they are about to take, so the two halves of one action agree.
   */
  it('uses one word per action across the menu item and its confirm button', async () => {
    const hidden = reviewRow({ isPublic: false });

    expect(menuLabelsFor(hidden)).toEqual(['Unhide review', 'Delete review']);
    cleanup();

    render(<ReviewTable filtered={false} rows={[hidden]} />);
    const [trigger] = screen.getAllByRole('button', { name: /^Actions for the review/ });
    fireEvent.keyDown(trigger!, { key: 'Enter' });
    fireEvent.click(screen.getAllByRole('menuitem')[0]!);

    /*
      `await`, because `RowMenu` opens the dialog on the next tick rather than
      inside `onSelect` — Radix closes the menu after that handler returns and
      moves focus back to the trigger as it goes, which would steal it from a
      dialog that opened synchronously.
    */
    expect(await screen.findByRole('button', { name: 'Unhide review' })).toBeDefined();

    /*
      The whole dialog, not just the button. The first attempt at this fix
      changed the title and the confirm label and left the body reading "you can
      show it again from here" — so an action with one name in the menu still
      had a second name in the prose describing it.
    */
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toMatch(/Unhide this review\?/);
    expect(dialog.textContent).not.toMatch(/\bshow\b/i);
  });

  /** The same, for the hide direction's body. */
  it('describes the way back as unhiding, not as showing', async () => {
    render(<ReviewTable filtered={false} rows={[reviewRow()]} />);
    const [trigger] = screen.getAllByRole('button', { name: /^Actions for the review/ });
    fireEvent.keyDown(trigger!, { key: 'Enter' });
    fireEvent.click(screen.getAllByRole('menuitem')[0]!);

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toMatch(/you can unhide it again from here/);
    expect(dialog.textContent).not.toMatch(/\bshow\b/i);
  });
});
