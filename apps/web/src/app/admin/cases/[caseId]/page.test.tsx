import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { interactiveInsideReadOnlyCards } from '@/components/admin/admin-detail.testing';
import type { WireAdminCaseDetail } from '@/lib/wire-schemas';

const getAdminCase = vi.fn<(caseId: string) => Promise<WireAdminCaseDetail | null>>();

vi.mock('@/lib/admin-data', () => ({ getAdminCase: (caseId: string) => getAdminCase(caseId) }));
vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const { default: AdminCasePage } = await import('./page');

const CASE_ID = '11111111-1111-4111-8111-111111111111';
const MESSAGE = 'Nobody arrived.\n\nI called four times — voicemail every time.';

function supportCase(overrides: Partial<WireAdminCaseDetail> = {}): WireAdminCaseDetail {
  return {
    id: CASE_ID,
    reference: 'ORL-4K7Q-P2',
    origin: 'user_report',
    status: 'open',
    topic: null,
    senderUserId: '22222222-2222-4222-8222-222222222222',
    senderName: 'Maya Rivera',
    senderEmail: 'maya@example.com',
    bookingId: '33333333-3333-4333-8333-333333333333',
    subjectType: 'conversation',
    subjectId: '44444444-4444-4444-8444-444444444444',
    reportReason: null,
    createdAt: new Date('2026-09-04T09:12:00Z'),
    message: MESSAGE,
    holdRefusal: null,
    emailFailedAt: null,
    networkOutcome: null,
    stripeDisputeId: 'dp_1QaB7cKz9LmN4dTvXy82Rq',
    resolvedByName: null,
    resolvedAt: null,
    booking: {
      id: '33333333-3333-4333-8333-333333333333',
      status: 'disputed',
      eventDate: '2026-09-12',
      customerName: 'Maya Rivera',
      vendorName: 'Kessler & Co.',
      vendorSlug: 'kessler-and-co',
      totalAmountCents: 260_000,
      platformFeeCents: 28_600,
      vendorPayoutCents: 231_400,
      refundAmountCents: null,
      paidAt: new Date('2026-08-20T16:41:00Z'),
      payoutReleasedAt: null,
      payoutStatus: 'held',
      disputeReason: 'product_not_received',
      cancelledBy: null,
      stripePaymentIntentId: 'pi_3PqR',
    },
    ...overrides,
  };
}

async function renderCase(detail: WireAdminCaseDetail) {
  getAdminCase.mockResolvedValue(detail);

  return render(await AdminCasePage({ params: Promise.resolve({ caseId: CASE_ID }) }));
}

function cardTitled(container: HTMLElement, title: string): HTMLElement {
  const card = [...container.querySelectorAll<HTMLElement>('[data-admin-card]')].find(
    (candidate) => candidate.querySelector('h2')?.textContent === title,
  );
  expect(card, `no card titled ${title}`).toBeDefined();

  return card as HTMLElement;
}

afterEach(cleanup);

/** `/admin/cases/[caseId]` against Pattern C (#393). */
describe('AdminCasePage', () => {
  /*
   * Acceptance 1 and 8 together, because the recomposition is exactly what
   * could break 8: the two-column grid lifts region 3 up the left column, and
   * doing that by reordering the DOM would put the resolve control ahead of the
   * booking for a keyboard and a screen reader. The DOM order is the reading
   * order; the placement is the grid's. Column geometry is jsdom-unverifiable
   * and is measured in `admin-detail-patterns.spec.ts`.
   */
  it('keeps the regions in reading order 1, 2, 3, and places 1 and 3 left, 2 right', async () => {
    const { container } = await renderCase(supportCase());

    const titles = [...container.querySelectorAll('[data-admin-card] h2')].map(
      (heading) => heading.textContent,
    );
    expect(titles).toEqual([
      '1 · The complaint',
      '2 · The booking it froze',
      'Reported thread',
      '3 · Resolve',
    ]);

    const grid = cardTitled(container, '1 · The complaint').parentElement as HTMLElement;
    expect(grid.className.split(/\s+/)).toContain('lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]');
    expect(cardTitled(container, '3 · Resolve').className.split(/\s+/)).toEqual(
      expect.arrayContaining(['lg:col-start-1', 'lg:row-start-2']),
    );
    expect(
      (cardTitled(container, '2 · The booking it froze').parentElement as HTMLElement).className
        .split(/\s+/)
        .filter((name) => name.startsWith('lg:')),
    ).toEqual(['lg:col-start-2', 'lg:row-span-2', 'lg:row-start-1']);
  });

  it('carries the case-scoped reported-thread card, with its scope stated', async () => {
    const { container } = await renderCase(supportCase());
    const thread = cardTitled(container, 'Reported thread');

    expect(thread.querySelector('[data-card-band]')?.textContent).toContain(
      'Case-scoped read · open cases only',
    );
    expect(screen.getByRole('button', { name: 'Read the reported thread' })).toBeDefined();
    expect(thread.textContent).toContain('scoped to this case');
  });

  /** A card that goes missing reads as a loading bug, so the thread card stays when there is no thread. */
  it('keeps the thread card, empty, when the case names no conversation', async () => {
    const { container } = await renderCase(
      supportCase({ subjectType: null, subjectId: null, origin: 'support_message' }),
    );

    expect(cardTitled(container, 'Reported thread').textContent).toContain(
      'This case names no conversation, so there is no thread to read.',
    );
    expect(screen.queryByRole('button', { name: 'Read the reported thread' })).toBeNull();
  });

  it('draws the sender block, the message on its inset, and a character count', async () => {
    const { container } = await renderCase(supportCase());
    const complaint = cardTitled(container, '1 · The complaint');

    const senderBlock = complaint.querySelector<HTMLElement>('[data-sender]');
    expect(senderBlock?.querySelector('[data-slot="avatar-fallback"]')?.textContent).toBe('MR');
    expect(senderBlock?.textContent).toBe(
      'MRMaya RiveraAccount · 22222222-2222-4222-8222-222222222222 · maya@example.com',
    );

    const inset = complaint.querySelector<HTMLElement>('[data-message-inset]');
    expect(inset?.textContent).toBe(MESSAGE);
    expect(inset?.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['bg-stone-50', 'border-stone-200', 'rounded-lg']),
    );
    // Counted in code points: the em dash is one character, not three bytes.
    expect(complaint.textContent).toContain(
      'Message shown in full — case bodies are never clamped. 60 characters.',
    );
  });

  it('names the card network as the sender of a chargeback', async () => {
    const { container } = await renderCase(
      supportCase({
        origin: 'chargeback',
        senderUserId: null,
        senderName: null,
        senderEmail: null,
      }),
    );

    expect(container.querySelector('[data-sender]')?.textContent).toBe(
      'TNThe card networkStripe webhook · no one to answer',
    );
  });

  it('prints the reported conversation id without the audited read', async () => {
    const { container } = await renderCase(supportCase());
    const thread = cardTitled(container, 'Reported thread');

    expect(
      [...thread.querySelectorAll('dt')].map((label) => [
        label.textContent,
        label.nextElementSibling?.textContent,
      ]),
    ).toEqual([['Conversation', '44444444-4444-4444-8444-444444444444']]);
  });

  it('does not repeat the address of a sender who gave no name', async () => {
    const { container } = await renderCase(
      supportCase({
        origin: 'support_message',
        senderUserId: null,
        senderName: null,
        senderEmail: 'a@example.com',
      }),
    );

    expect(container.querySelector('[data-sender]')?.textContent).toBe('Aa@example.comSigned out');
  });

  it('keeps the mail refusal and the hold refusal in region 1, as alerts', async () => {
    const { container } = await renderCase(
      supportCase({
        origin: 'support_message',
        emailFailedAt: new Date('2026-09-04T09:13:00Z'),
        holdRefusal: 'The payout was already released.',
      }),
    );
    const complaint = cardTitled(container, '1 · The complaint');

    expect(
      [...complaint.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent),
    ).toEqual([
      'This report never reached the support inbox — the mail service refused it on Sep 4, 2026, 09:13 UTC. The payout is still on hold — the withdrawal did not go through, so rule on it below. Answer the sender from here.',
      'The payout could not be put on hold: The payout was already released.',
    ]);
  });

  it('puts no interactive element inside any read-only card', async () => {
    const { container } = await renderCase(supportCase());

    expect(interactiveInsideReadOnlyCards(container)).toEqual({
      '1 · The complaint': 0,
      '2 · The booking it froze': 0,
    });
    // And the guard can fail: the resolve card is not read-only and does hold controls.
    expect(cardTitled(container, '3 · Resolve').querySelectorAll('button').length).toBeGreaterThan(
      0,
    );
  });

  it('draws a header band on every card, and the money note only when money can move', async () => {
    const { container } = await renderCase(supportCase());

    for (const card of container.querySelectorAll('[data-admin-card]')) {
      expect(card.firstElementChild?.hasAttribute('data-card-band')).toBe(true);
      expect(card.className.split(/\s+/)).toContain('rounded-panel');
    }
    expect(cardTitled(container, '3 · Resolve').textContent).toContain(
      'Moves money. Both positions confirm first.',
    );

    cleanup();
    const settled = await renderCase(
      supportCase({ booking: { ...supportCase().booking!, status: 'completed' } }),
    );
    expect(cardTitled(settled.container, '3 · Resolve').textContent).not.toContain('Moves money');
  });

  it('renders identifiers, dates and money as mono values beside a label', async () => {
    const { container } = await renderCase(supportCase());
    const booking = cardTitled(container, '2 · The booking it froze');

    const kinds = Object.fromEntries(
      [...booking.querySelectorAll('dt')].map((label) => [
        label.textContent,
        label.nextElementSibling?.getAttribute('data-kind'),
      ]),
    );
    expect(kinds).toEqual({
      Booking: 'mono',
      Total: 'mono',
      'Platform fee': 'mono',
      'Vendor payout': 'mono',
      'Paid at': 'mono',
      'Payout released': 'mono',
      'Refund amount': 'mono',
      'Cancelled by': 'text',
      'Dispute reason': 'text',
      Chargeback: 'mono',
      'Network outcome': 'text',
      'Payment intent': 'mono',
    });
    expect(booking.textContent).toContain('Aug 20, 2026, 16:41 UTC');
  });
});
