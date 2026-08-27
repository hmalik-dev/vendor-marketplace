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
      {...overrides}
    />,
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
   * The bug this ticket exists to prevent: an earlier revision pulled the
   * avatar up with a negative margin, across a pane's `overflow:hidden`, and
   * the browser sliced its top edge off. Nothing here may reintroduce one.
   */
  it('never pulls the identity row up into the cover', () => {
    const { container } = renderHeader();

    for (const element of container.querySelectorAll('*')) {
      expect(element.className.toString()).not.toMatch(/-mt-|margin-top:\s*-/);
    }
  });

  it('keeps the cover at a fixed 150px with a border box', () => {
    renderHeader();

    const cover = screen.getByTestId('profile-cover');

    expect(cover.className).toContain('h-[150px]');
    expect(cover.className).toContain('box-border');
  });
});
