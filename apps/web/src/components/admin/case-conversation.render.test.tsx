import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminConversationMessages } from '@/lib/wire-schemas';

const request = vi.fn<() => Promise<WireAdminConversationMessages>>();

vi.mock('@/lib/use-api', () => ({ useApi: () => request }));

const { CaseConversation, windowLabel } = await import('./case-conversation');

/*
 * The reported thread's chip and footer against Pattern C §2 (VEN-412).
 *
 * The frame prints `Case-scoped read · 12 Sep only` and a line saying the read
 * is scoped to the event date. Both are claims about what the server returned,
 * so every date asserted here arrives in the mocked response and none is
 * worked out by the component.
 */

const CONVERSATION_ID = '44444444-4444-4444-8444-444444444444';

function thread(window: WireAdminConversationMessages['window']): WireAdminConversationMessages {
  return {
    conversationId: CONVERSATION_ID,
    caseId: '11111111-1111-4111-8111-111111111111',
    caseReference: 'ORL-4K7Q-P2',
    customerName: 'Maya Rivera',
    vendorName: 'Kessler & Co.',
    window,
    messages: {
      items: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          senderId: '66666666-6666-4666-8666-666666666666',
          senderName: 'Maya Rivera',
          senderSide: 'customer',
          content: 'Hi — we’re at the venue, are you close?',
          readAt: null,
          createdAt: new Date('2026-09-12T14:06:00Z'),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    },
  };
}

afterEach(() => {
  cleanup();
  request.mockReset();
});

async function openThread(window: WireAdminConversationMessages['window']): Promise<HTMLElement> {
  request.mockResolvedValue(thread(window));
  const { container } = render(<CaseConversation conversationId={CONVERSATION_ID} />);

  fireEvent.click(screen.getByRole('button', { name: 'Read the reported thread' }));
  await screen.findByText('Hi — we’re at the venue, are you close?');

  return container.querySelector('[data-admin-card]') as HTMLElement;
}

describe('CaseConversation', () => {
  it('prints the served event date in the chip and the frame’s footer', async () => {
    const card = await openThread({ basis: 'event_date', from: '2026-09-12', to: '2026-09-12' });

    expect(card.querySelector('[data-card-band]')?.textContent).toBe(
      'Reported threadCase-scoped read · 12 Sep only',
    );
    expect(card.textContent).toContain(
      'Read-only, and scoped to the event date. Operators see the messages the case is about, not the relationship’s whole history.',
    );
  });

  it('prints the week a bookingless report was filed, and says that is the scope', async () => {
    const card = await openThread({ basis: 'report_filed', from: '2026-09-06', to: '2026-09-12' });

    expect(card.querySelector('[data-card-band]')?.textContent).toBe(
      'Reported threadCase-scoped read · 6–12 Sep',
    );
    expect(card.textContent).toContain('scoped to the week the report was filed');
    expect(card.textContent).not.toContain('scoped to the event date');
  });

  it('names no dates before the read, and keeps the conversation id visible', () => {
    const { container } = render(<CaseConversation conversationId={CONVERSATION_ID} />);

    expect(container.querySelector('[data-card-band]')?.textContent).toBe(
      'Reported threadCase-scoped read',
    );
    expect(container.textContent).toContain(CONVERSATION_ID);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('windowLabel', () => {
  it('names both months when the window crosses one', () => {
    expect(windowLabel({ basis: 'report_filed', from: '2026-08-29', to: '2026-09-04' })).toBe(
      '29 Aug – 4 Sep',
    );
  });
});
