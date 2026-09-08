import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminVendorStatus } from '@vendor-marketplace/shared';
import type { WireAdminVendorRow } from '@/lib/wire-schemas';

vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { SuspensionConsequence, UnpublishConsequence, RepublishConsequence, VendorTable } =
  await import('./vendor-table');

function vendorRow(status: AdminVendorStatus): WireAdminVendorRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    businessName: 'Fernbank Studio',
    slug: 'fernbank-studio',
    categoryName: 'Photography',
    city: 'Austin',
    state: 'TX',
    avgRating: '4.50',
    reviewCount: 2,
    bookingsCount: 7,
    status,
    stripeOnboarded: true,
    /* #432's payout-health fields. A connected vendor with nothing outstanding. */
    stripeAccountId: 'acct_test_fernbank',
    stripeDisabledReason: null,
    stripeRequirementsDue: [],
    createdAt: new Date('2026-05-04T00:00:00Z'),
  };
}

/** Opens the first `···` and returns the menu item labels, in order. */
function menuLabelsFor(status: AdminVendorStatus): string[] {
  render(<VendorTable filtered={false} rows={[vendorRow(status)]} />);
  const [trigger] = screen.getAllByRole('button', { name: /^Actions for/ });
  // Radix opens a `DropdownMenu` from the keyboard as well as the pointer, and
  // jsdom has no PointerEvent — so the keyboard path is the one that works here.
  fireEvent.keyDown(trigger!, { key: 'Enter' });

  return screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
}

/** The rendered sentence, with the JSX fragments collapsed back into prose. */
function copyOf(element: React.ReactElement): string {
  const { container } = render(element);

  return container.textContent ?? '';
}

afterEach(cleanup);

describe('SuspensionConsequence', () => {
  /*
   * #416 / D31. A suspension refunds every future confirmed booking, and that
   * refund reverses the vendor's transfer back out of their connected account
   * — which can take a vendor already paid out negative. The operator is the
   * only party who can weigh that before pressing the button, so the dialog
   * describing the action has to name it rather than stop at "refunded in
   * full".
   */
  it('names the payout reversal, not only the refund', () => {
    render(<SuspensionConsequence subject="Their storefront" />);

    expect(screen.getByText(/refunded in full/)).toBeDefined();
    expect(
      screen.getByText(
        /reverses the vendor's share out of their Stripe balance and can leave it negative/,
      ),
    ).toBeDefined();
  });

  /** One dialog is about several accounts, the other about one. */
  it('takes its subject from the caller', () => {
    render(<SuspensionConsequence subject="Every storefront" />);

    expect(screen.getByText(/Every storefront comes down\./)).toBeDefined();
  });
});

/**
 * #435, acceptance 3 — **the unpublish dialog cannot be confused with the
 * suspend dialog**, asserted on the copy, because that is the whole risk of the
 * ticket.
 *
 * The two controls sit in the same overflow menu on the same row. One takes a
 * storefront off search and is undone from that same menu; the other declines
 * every open request, cancels every confirmed booking, refunds them in full and
 * reverses the vendor's share out of their Stripe balance. An operator who reads
 * the wrong one and acts has destroyed a business by mistake, so the distinction
 * has to be carried by the words rather than by remembering which item they
 * clicked.
 */
describe('UnpublishConsequence, against the dialog it sits beside', () => {
  it('names every unwind in the suspension copy and promises none of them here', () => {
    /*
     * The three promises a suspension makes, matched as whole clauses rather
     * than as the words in them: the unpublish copy uses "cancelled" and
     * "refund" too — in the sentence saying neither happens — and a bare
     * `/cancelled/` cannot tell the promise from its denial.
     *
     * Both directions, deliberately. Asserting only that unpublishing omits the
     * clauses would still pass if the suspension copy lost them too, and two
     * dialogs that both describe nothing are as confusable as two that describe
     * the same thing.
     */
    const unwinds = [
      /open requests are declined/,
      /every confirmed booking in the future is cancelled/,
      /refunded in full/,
    ];

    for (const unwind of unwinds) {
      expect(copyOf(<SuspensionConsequence subject="Their storefront" />)).toMatch(unwind);
      cleanup();
      expect(copyOf(<UnpublishConsequence subject="Their storefront" />)).not.toMatch(unwind);
      cleanup();
    }
  });

  it('says outright that unpublishing unwinds nothing', () => {
    const copy = copyOf(<UnpublishConsequence subject="Their storefront" />);

    expect(copy).toMatch(/Nothing is cancelled and no money moves/);
    expect(copy).toMatch(/open requests stand, confirmed bookings stand/);
    expect(copy).toMatch(/no refund is issued/);
  });

  it('offers the way back, where suspension says its damage is not undone', () => {
    expect(copyOf(<UnpublishConsequence subject="Their storefront" />)).toMatch(
      /this menu can publish it again/,
    );
    cleanup();
    expect(copyOf(<SuspensionConsequence subject="Their storefront" />)).toMatch(
      /the bookings are not restored/,
    );
  });

  /**
   * The way back is the **operator's**, and the copy has to say so (#457).
   *
   * This sentence read *"Publish it again from this menu whenever you like"*
   * until the moderation hold landed, at which point it described — on the
   * control that removes the ability, to the operator, at the instant of the
   * press — the exact ability it removes. A consequence line that contradicts
   * the consequence is worse than no line.
   *
   * Both directions, because only one of them catches the regression that
   * matters. Asserting the new clause alone would pass a copy edit that added
   * it and left the old promise standing beside it, which is the likeliest way
   * this comes back: someone restoring a sentence that reads reassuring and is
   * false. `31-content-voice.md` carries the ruling and points here.
   */
  it('says the vendor cannot put it back, and does not promise them they can', () => {
    const copy = copyOf(<UnpublishConsequence subject="Their storefront" />);

    expect(copy).toMatch(/the vendor cannot put it back themselves/);
    expect(copy).not.toMatch(/whenever you like/);
  });

  /*
   * The approved-strings file makes the same claim, matched on the claim rather
   * than on the wording — the table cell is a summary and the dialog is prose,
   * so they are deliberately different lengths and an equality check between
   * them would only ever be noise. What must not drift is which of the two
   * parties can undo this.
   */
  it('agrees with the approved consequence line in 31-content-voice.md', () => {
    const voice = readFileSync(
      join(process.cwd(), '../../design/design-plan/31-content-voice.md'),
      'utf8',
    );
    const row = voice
      .split('\n')
      .find((line) => line.includes('**Unpublish profile**') && line.startsWith('|'));

    expect(row, 'the Unpublish profile row is missing from the approved-copy table').toBeDefined();
    expect(row).toMatch(/only an operator can/i);
    expect(row).not.toMatch(/whenever you like/);
  });

  it('takes its subject from the caller, like its neighbour', () => {
    expect(copyOf(<UnpublishConsequence subject="Every storefront" />)).toMatch(
      /Every storefront comes off search/,
    );
  });
});

/**
 * The row control itself, which #435 rewrote from a single dialog into a menu.
 *
 * **`ReviewTable` got this and `VendorTable` did not, and an adversarial review
 * proved the gap by mutation**: deleting the `retired` guard and inverting the
 * publish label both left the entire web suite — 202 files, 2898 tests — green.
 * Two operator-facing breakages shipping silently is what an untested control
 * costs, so each assertion below names the mutation it fails on.
 */
describe('VendorRowActions', () => {
  /*
   * Fails on `published = row.status === 'paused'`, and on any swap of the two
   * labels: a `live` storefront is the one you can take down.
   */
  it('offers Unpublish on a live storefront and Publish on an unpublished one', () => {
    expect(menuLabelsFor('live')).toEqual(['Unpublish profile', 'Suspend vendor']);
    cleanup();
    /*
     * Both directions on a row that is already down (#457). Unpublish is what
     * sets the moderation hold, so a menu that offered only Publish here left
     * the one vendor an operator could not moderate as the one who had taken
     * themselves down first — which is the evasion the hold exists to close,
     * and is reachable in one request from the vendor's own dashboard.
     *
     * Order is least → most severe, per the admin delta's Pattern B.
     */
    expect(menuLabelsFor('paused')).toEqual([
      'Publish profile',
      'Unpublish profile',
      'Suspend vendor',
    ]);
    cleanup();
    expect(menuLabelsFor('review')).toEqual([
      'Publish profile',
      'Unpublish profile',
      'Suspend vendor',
    ]);
  });

  /*
   * The drawn copy, and the reason these are assertions rather than a
   * preference (#454, closing #456).
   *
   * #435 shipped `Unpublish storefront` and `Suspend account` before any frame
   * drew this surface. The drawn bundle in `design/delta-admin/` then drew the
   * Actions card naming them **`Unpublish profile`** and **`Suspend vendor`**,
   * which makes them text-parity findings against a frame rather than taste —
   * `web-design-parity.md` is explicit that "same composition with reworded
   * copy has failed too".
   *
   * The *inverse* and *plural* labels are not drawn and were changed with them
   * on coherence grounds: `Publish storefront` sitting in the same menu as
   * `Unpublish profile` gives an operator two nouns for one object. The
   * consequence prose still says "storefront", deliberately — the button names
   * the record and the description names the effect, and #456 recorded the
   * descriptions as already agreeing with the frame.
   */
  it('names the vendor record the way the frame draws it, in every label', () => {
    const drawn = ['Unpublish profile', 'Publish profile', 'Suspend vendor', 'Suspend vendors'];
    const retired = ['Unpublish storefront', 'Publish storefront', 'Suspend account'];

    const source = readFileSync(
      join(process.cwd(), 'src/components/admin/vendor-table.tsx'),
      'utf8',
    ).replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '');

    for (const label of drawn) {
      // Quote-agnostic: JSX attributes take `"` and the menu items take `'`.
      expect(source, label).toMatch(new RegExp(`['"]${label}['"]`));
    }
    /*
     * The half that can actually fail. Stripping comments first is what makes
     * it able to: the paragraph above quotes all three retired labels, so
     * against the raw file this assertion is unfailable.
     */
    for (const label of retired) {
      expect(source, label).not.toContain(label);
    }
  });

  /** A suspended account is offered the lift and nothing else. */
  it('offers only the lift on a suspended account', () => {
    expect(menuLabelsFor('flagged')).toEqual(['Lift suspension']);
  });

  /*
   * Fails on deleting `if (row.status === 'retired') return null`.
   *
   * #433 ruled that a retired row draws no control, and
   * `.claude/rules/web-design-parity.md` records it as a deliberate difference
   * from frame `13`. #435 rewrote this cell from scratch, so the rule needed
   * re-establishing here rather than inheriting: every item the menu could
   * offer targets an owner `findUserById` filters out, and answers 404 or 409.
   */
  it('draws no control at all on a retired vendor', () => {
    render(<VendorTable filtered={false} rows={[vendorRow('retired')]} />);

    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull();
  });

  /** The trigger names its row, so the menu is not an anonymous glyph. */
  it('names the row it acts on', () => {
    render(<VendorTable filtered={false} rows={[vendorRow('live')]} />);

    // Two: the grid rendering and the card rendering of the same row.
    expect(screen.getAllByRole('button', { name: 'Actions for Fernbank Studio' })).toHaveLength(2);
  });
});

/**
 * Republishing is not always an undo, and the dialog must not imply it is.
 *
 * `is_published` records that a storefront is down and never who put it down —
 * an operator moderating it and a vendor pausing their own trading write the
 * same column. So the console can offer Publish on a row it cannot explain, and
 * the operator can put a business back on the marketplace against its owner's
 * own choice. Flagged by the adversarial review as the mirror of the recorded
 * acceptance-1 amendment.
 *
 * **#457 answered half of it and the copy still stands for the other half.**
 * A storefront moderated from now on reads `Held` in the row's own status, so
 * that case explains itself before the dialog opens. Every row that reads
 * `Paused` or `Review` is still the ambiguous one — the vendor's own pause and
 * every moderation taken before the hold column existed both land there, and
 * nothing distinguishes them. So this warning is not stale; it is now the
 * warning for the rows that are still unexplained, and the dialog's own
 * justification clause is the part that has narrowed. Rewording it is a copy
 * change the design pass owns, filed with #457's other two unratified strings.
 */
describe('RepublishConsequence', () => {
  it('warns that the storefront may have been paused by its own owner', () => {
    const copy = copyOf(<RepublishConsequence subject="Their storefront" />);

    expect(copy).toMatch(/Check why it came down first/);
    expect(copy).toMatch(/a vendor can unpublish their own storefront/);
    expect(copy).toMatch(/whether it was moderated or paused by its owner/);
  });

  it('still names the one condition the API enforces', () => {
    expect(copyOf(<RepublishConsequence subject="Their storefront" />)).toMatch(
      /a category, a bio, a reply time and one bookable package/,
    );
  });
});

/**
 * The moderation hold's one console-facing requirement (#457, acceptance 6).
 *
 * `is_published` recorded that a storefront was down and never who put it
 * down, so an operator arriving at an unpublished row could not tell their
 * colleague's moderation from the vendor's own pause — the ambiguity
 * `RepublishConsequence` warns about in prose because nothing on the row could
 * answer it. `moderation_hold` answers it, and `Held` is how the table says so.
 */
describe('the held status (#457)', () => {
  /** The pill's own attribute, so the assertion survives a Tailwind class edit. */
  function pillFor(status: AdminVendorStatus): { label: string; tone: string } {
    render(<VendorTable filtered={false} rows={[vendorRow(status)]} />);
    const [pill] = document.querySelectorAll('[data-slot="status-pill"]');

    return {
      label: pill?.textContent ?? '',
      tone: pill?.getAttribute('data-tone') ?? '',
    };
  }

  /*
   * Fails on a `held: 'inert'` entry, which is the mistake worth guarding: it
   * would draw a moderated storefront in the same grey as one the vendor
   * paused, which is the exact confusion this status exists to end.
   */
  it('draws Held apart from Paused, in the tone the other moderation state spends', () => {
    expect(pillFor('held')).toEqual({ label: 'Held', tone: 'needsYou' });
    cleanup();
    expect(pillFor('paused')).toEqual({ label: 'Paused', tone: 'inert' });
    cleanup();
    /* Shared with `Flagged` deliberately — both say an operator did this. */
    expect(pillFor('flagged')).toEqual({ label: 'Flagged', tone: 'needsYou' });
  });

  /*
   * The clearing lever. A held storefront is unpublished, so the menu offers
   * the publish direction — and `PUT /admin/vendors/:id/publish` is the only
   * writer that clears the hold, which makes this menu item the whole of
   * acceptance 3's operator path.
   */
  it('offers the operator the publish direction on a held row, and only that', () => {
    /* No Unpublish: the hold it would set already stands. */
    expect(menuLabelsFor('held')).toEqual(['Publish profile', 'Suspend vendor']);
  });
});
