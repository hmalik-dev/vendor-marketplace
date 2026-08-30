import type { Tag } from '@vendor-marketplace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProfileHeader } from './profile-header';

const CATEGORIES = [{ id: 'cat-1', name: 'Photography', slug: 'photography' }];

function tag(id: string, name: string): Tag {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    category: 'cultural',
    displayOrder: 1,
    isActive: true,
    createdAt: new Date(),
  };
}

function renderHeader(overrides: Partial<Parameters<typeof ProfileHeader>[0]> = {}) {
  return render(
    <ProfileHeader
      businessName="Kessler & Co."
      coverImageUrl={null}
      profileImageUrl={null}
      tagline={null}
      avgRating={4.9}
      reviewCount={127}
      city="Austin"
      state="TX"
      freeOn={null}
      categories={CATEGORIES}
      tags={[]}
      rail={<div data-testid="rail-slot" />}
      {...overrides}
    >
      <div data-testid="main-slot" />
    </ProfileHeader>,
  );
}

describe('ProfileHeader', () => {
  afterEach(() => {
    cleanup();
  });

  it('names the business as the page heading', () => {
    renderHeader();

    expect(screen.getByRole('heading', { level: 1, name: 'Kessler & Co.' })).toBeDefined();
  });

  it('shows the rating and review count together', () => {
    renderHeader();

    expect(screen.getByText('4.9')).toBeDefined();
    expect(screen.getByText('(127 reviews)')).toBeDefined();
  });

  /*
   * A vendor with no reviews must not read "0.0", which looks like a bad score
   * rather than an absent one — the same rule the vendor card follows.
   */
  it('says a new vendor is new rather than showing a zero score', () => {
    renderHeader({ avgRating: 0, reviewCount: 0 });

    expect(screen.getByText('New — no reviews yet')).toBeDefined();
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('reads one review in the singular', () => {
    renderHeader({ reviewCount: 1 });

    expect(screen.getByText('(1 review)')).toBeDefined();
  });

  it('collapses the tags past the third into a count', () => {
    renderHeader({
      tags: [
        tag('t1', 'English'),
        tag('t2', 'Spanish'),
        tag('t3', 'Documentary'),
        tag('t4', 'Film'),
        tag('t5', 'Drone'),
      ],
    });

    expect(screen.getByText('+2 more')).toBeDefined();
  });

  it('omits the location line when a vendor has not given one', () => {
    renderHeader({ city: null, state: null });

    expect(screen.queryByText('Austin, TX')).toBeNull();
  });

  /*
   * The five rules of `CHANGE-ORDER-2026-08-29.md` that a rebuild must not
   * break. Rules 2 and 3 are the ones every previous build got wrong, and both
   * are asserted structurally rather than visually: a browser check only proves
   * them at the widths it visits, and the failure was a negative margin
   * crossing a clipping boundary, which is a property of the markup.
   */
  describe('the cover rework', () => {
    it('draws no banner and no overlap anywhere in the header', () => {
      const { container } = renderHeader();

      const markup = container.innerHTML;
      expect(markup).not.toMatch(/-mt-\[/);
      expect(markup).not.toContain('h-[196px]');
      expect(markup).not.toContain('z-[2]');
    });

    /*
     * Rule 2: identity is never on the photograph. Nothing is pulled, so the
     * old failure is unreachable rather than merely avoided — there is no
     * negative margin left for a clipping ancestor to slice against.
     */
    it('puts identity and cover side by side rather than one over the other', () => {
      renderHeader();

      const card = screen.getByTestId('profile-identity-card');
      const cover = screen.getByTestId('profile-cover');

      expect(card.className).toContain('flex');
      expect(cover.parentElement).toBe(card);
      expect(cover.className).not.toMatch(/absolute|-mt-|z-/);
    });

    /*
     * Rule 3: identity reads before the cover at every width, and 390 is the
     * only width that stacks — identity ABOVE cover. In DOM order that means
     * the identity pane is the first child and the stack is `flex-col`, never
     * `flex-col-reverse`.
     */
    it('reads identity before the cover, and stacks it above at the narrow width', () => {
      renderHeader();

      const card = screen.getByTestId('profile-identity-card');
      const cover = screen.getByTestId('profile-cover');

      expect(card.firstElementChild).not.toBe(cover);
      expect(card.lastElementChild).toBe(cover);
      expect(card.className).toContain('flex-col');
      expect(card.className).not.toContain('flex-col-reverse');
      expect(card.className).not.toContain('flex-row-reverse');
    });

    it('sizes the cover to the frame width at each breakpoint it draws', () => {
      renderHeader();

      const cover = screen.getByTestId('profile-cover');

      expect(cover.className).toContain('md:w-[268px]');
      expect(cover.className).toContain('lg:w-[280px]');
      expect(cover.className).toContain('xl:w-[300px]');
    });

    /* One cover file per vendor, and it carries no link and no counter. */
    it('makes the cover inert — no link, no gallery affordance', () => {
      renderHeader({ coverImageUrl: 'https://cdn.test/cover.jpg' });

      const cover = screen.getByTestId('profile-cover');

      expect(cover.querySelector('a')).toBeNull();
      expect(cover.querySelector('button')).toBeNull();
    });

    it('sizes the avatar to the frame and gives it no ring', () => {
      renderHeader();

      const avatar = screen.getByText('KC');

      expect(avatar.getAttribute('style')).toContain('60px');
      expect(avatar.className).not.toContain('border-4');
    });
  });

  describe('the identity card', () => {
    /*
      The chip that persists from the vendor's search card, and the reason the
      header reads as that card unpacked rather than as a new composition.
    */
    it('leads the chips with the availability chip when there is a free date', () => {
      renderHeader({ freeOn: 'Jun 14' });

      const chips = Array.from(document.querySelectorAll('li')).map((node) => node.textContent);
      expect(chips[0]).toBe('Free Jun 14');
    });

    it('omits the availability chip entirely when nothing is free', () => {
      renderHeader({ freeOn: null });

      expect(screen.queryByText(/^Free /)).toBeNull();
    });

    /* The tagline moved here out of the About pane, which no longer repeats it. */
    it('carries the tagline, in straight quotation marks', () => {
      renderHeader({ tagline: 'Quiet, documentary, never asks you to pose.' });

      expect(screen.getByText('"Quiet, documentary, never asks you to pose."')).toBeDefined();
    });

    it('renders no tagline element when the vendor has not written one', () => {
      const { container } = renderHeader({ tagline: null });

      expect(container.querySelector('.italic')).toBeNull();
    });

    /*
      The frame's own character. A filled clay SVG was a heavier mark than the
      design draws and sat off the line's baseline.
    */
    it('draws the rating star as the frame glyph rather than an icon', () => {
      const { container } = renderHeader();

      expect(screen.getByText('★')).toBeDefined();
      expect(container.querySelector('svg')).toBeNull();
    });
  });
});
