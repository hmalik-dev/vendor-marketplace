import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MAX_TAGS_PER_CATEGORY } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminTagSuggestionRow } from '@/lib/wire-schemas';

const refresh = vi.fn();
let answer: unknown = null;

vi.mock('@/lib/use-api', () => ({ useApi: () => async () => answer }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { TagQueue, assignmentNotice } = await import('./tag-queue');

const SUGGESTION: WireAdminTagSuggestionRow = {
  id: '11111111-1111-4111-8111-111111111111',
  vendorId: '22222222-2222-4222-8222-222222222222',
  suggestedName: 'Gluten Free',
  category: 'dietary',
  status: 'pending',
  resolvedTagId: null,
  adminNote: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  resolvedAt: null,
  vendorName: 'Sunlit Studio',
  resolvedTagName: null,
} as WireAdminTagSuggestionRow;

afterEach(() => {
  cleanup();
  refresh.mockClear();
});

describe('assignmentNotice', () => {
  it('says nothing when the vendor was given the tag, or on a rejection', () => {
    expect(assignmentNotice(SUGGESTION, 'assigned')).toBeNull();
    expect(assignmentNotice(SUGGESTION, null)).toBeNull();
  });

  it('names the ceiling when the vendor was full', () => {
    expect(assignmentNotice(SUGGESTION, 'category-full')).toBe(
      `“Gluten Free” was approved, but the vendor already has ${MAX_TAGS_PER_CATEGORY} tags in that category, so it was not added to their profile. They were told.`,
    );
  });

  it('says there was no storefront to add it to', () => {
    expect(assignmentNotice(SUGGESTION, 'no-profile')).toContain('has no storefront yet');
  });
});

describe('TagQueue', () => {
  it('keeps telling the admin why after the resolved card leaves the list', async () => {
    answer = { suggestion: SUGGESTION, tag: null, assignment: 'category-full' };
    const { rerender } = render(<TagQueue suggestions={[SUGGESTION]} tags={[]} showActions />);

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve tag' }));
    });
    // The pending list refreshes without the card.
    rerender(<TagQueue suggestions={[]} tags={[]} showActions />);

    expect(screen.getByRole('status').textContent).toContain(
      'so it was not added to their profile',
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
