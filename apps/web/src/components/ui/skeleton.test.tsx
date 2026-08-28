import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BookingCardSkeleton, MessageBubbleSkeleton, Skeleton } from './skeleton';

afterEach(cleanup);

/**
 * A skeleton's whole job is that nothing moves when the data lands, so what is
 * worth asserting is not that it renders but that it keeps the real
 * component's measurements and stays out of the accessibility tree.
 */
describe('Skeleton', () => {
  it('is hidden from assistive technology — it has nothing to announce', () => {
    const { container } = render(<Skeleton />);

    expect(container.querySelector('[data-slot=skeleton]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

describe('BookingCardSkeleton', () => {
  it("keeps the real card's radius, padding and shadow so the grid does not shift", () => {
    const { container } = render(<BookingCardSkeleton />);
    const card = container.querySelector('[data-slot=skeleton-booking-card]');

    expect(card?.className).toContain('rounded-[14px]');
    expect(card?.className).toContain('p-3.5');
    expect(card?.className).toContain('shadow-sm');
  });

  /* The card leads with a 9.5 avatar tile opposite its status pill. */
  it('mirrors the avatar tile and the status pill', () => {
    const { container } = render(<BookingCardSkeleton />);
    const parts = Array.from(container.querySelectorAll('[data-slot=skeleton]')).map(
      (node) => node.className,
    );

    expect(parts[0]).toContain('size-9.5');
    expect(parts[0]).toContain('rounded-[9px]');
    expect(parts[1]).toContain('rounded-full');
  });

  it('is a list item, because the real cards are', () => {
    const { container } = render(<BookingCardSkeleton />);

    expect(container.querySelector('li')).not.toBeNull();
  });
});

describe('MessageBubbleSkeleton', () => {
  /*
   * The tail is a single squared corner on the sender's side. Mirroring it is
   * what makes a column of blocks read as a conversation rather than a form.
   */
  it('squares the corner on the sender’s side', () => {
    const { container: theirs } = render(<MessageBubbleSkeleton />);
    const { container: mine } = render(<MessageBubbleSkeleton mine />);

    expect(theirs.querySelector('[data-slot=skeleton]')?.className).toContain(
      'rounded-[14px_14px_14px_4px]',
    );
    expect(mine.querySelector('[data-slot=skeleton]')?.className).toContain(
      'rounded-[14px_14px_4px_14px]',
    );
  });

  it('sits on the sender’s side of the pane', () => {
    const { container: theirs } = render(<MessageBubbleSkeleton />);
    const { container: mine } = render(<MessageBubbleSkeleton mine />);

    expect(theirs.querySelector('[data-slot=skeleton-message-bubble]')?.className).toContain(
      'self-start',
    );
    expect(mine.querySelector('[data-slot=skeleton-message-bubble]')?.className).toContain(
      'self-end',
    );
  });

  /* A bubble that filled the pane would misrepresent the shape of the thread. */
  it('never exceeds the 62% the real bubble is capped at', () => {
    const { container } = render(<MessageBubbleSkeleton />);

    expect(container.querySelector('[data-slot=skeleton-message-bubble]')?.className).toContain(
      'max-w-[62%]',
    );
  });
});
