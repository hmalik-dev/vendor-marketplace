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
    category: 'style',
    isActive: true,
    createdAt: new Date(),
  } as unknown as Tag;
}

function renderHeader(overrides: Partial<Parameters<typeof ProfileHeader>[0]> = {}) {
  return render(
    <ProfileHeader
      businessName="Kessler & Co."
      coverImageUrl={null}
      profileImageUrl={null}
      avgRating={4.9}
      reviewCount={127}
      city="Austin"
      state="TX"
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
   * Frame `03` reinstates the overlap that an earlier revision flattened. All
   * three declarations are asserted together because they are what make it
   * safe: the lift alone reintroduces the bug where the avatar's top edge was
   * sliced off, and without `relative`/`z-index` the banner paints over it.
   */
  it('lifts the identity row into the banner, positioned and stacked above it', () => {
    renderHeader();

    const row = screen.getByTestId('profile-identity');

    expect(row.className).toContain('-mt-[34px]');
    expect(row.className).toContain('relative');
    expect(row.className).toContain('z-[2]');
  });

  /*
   * The lift is only safe while nothing between the row and the banner clips.
   * This is the structural half of the same guarantee — a browser check can
   * only prove it for the widths it visits, this proves it for the markup.
   */
  it('puts nothing that clips between the banner and the lifted row', () => {
    const { container } = renderHeader();

    const row = screen.getByTestId('profile-identity');
    const wrapper = container.firstElementChild;

    expect(wrapper).not.toBeNull();
    for (let node = row.parentElement; node && node !== container; node = node.parentElement) {
      expect(node.className.toString()).not.toMatch(/\boverflow-hidden\b/);
    }
    expect(wrapper?.className).toContain('overflow-visible');
  });

  it('keeps the banner at a fixed 196px with a border box', () => {
    renderHeader();

    const cover = screen.getByTestId('profile-cover');

    expect(cover.className).toContain('h-[196px]');
    expect(cover.className).toContain('box-border');
  });

  /*
   * The ring matches the page ground rather than the card surface, so the
   * avatar reads as cut out of the banner instead of outlined on it.
   */
  it('rings the avatar in stone-50 at 82px, with the ring inside the size', () => {
    renderHeader();

    const avatar = screen.getByRole('img', { name: 'Kessler & Co.' });

    expect(avatar.className).toContain('border-4');
    expect(avatar.className).toContain('border-stone-50');
    expect(avatar.className).toContain('box-border');
    expect(avatar.getAttribute('style')).toContain('82px');
  });

  /** A vendor with no cover still gets the full banner, and the overlap. */
  it('keeps the 196px banner and the overlap when there is no cover', () => {
    renderHeader({ coverImageUrl: null });

    expect(screen.getByTestId('profile-cover').className).toContain('h-[196px]');
    expect(screen.getByTestId('profile-identity').className).toContain('-mt-[34px]');
  });
});
