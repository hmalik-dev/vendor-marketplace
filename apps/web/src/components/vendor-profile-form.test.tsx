import { describe, expect, it } from 'vitest';
import { liveBlockers, mergeBlockers, type FormState } from './vendor-profile-form';

/** A form state with nothing outstanding, for each test to spoil one field of. */
const COMPLETE: FormState = {
  businessName: 'Kessler & Co.',
  slug: 'kessler-co',
  bio: 'Ten years photographing weddings across central Texas.',
  tagline: 'Editorial polish without the editorial fuss.',
  yearsInBusiness: '9',
  address: '1204 E Cesar Chavez St',
  city: 'Austin',
  state: 'TX',
  serviceRadiusMiles: 60,
  responseTimeHours: '24',
  profileImageUrl: null,
  categoryIds: ['photography'],
  tagIds: [],
};

describe('liveBlockers', () => {
  it('finds nothing outstanding in a complete form', () => {
    expect(liveBlockers(COMPLETE)).toEqual([]);
  });

  it.each([
    ['businessName', { businessName: '   ' }],
    ['bio', { bio: '' }],
    ['categories', { categoryIds: [] }],
    ['location', { city: '' }],
    ['location', { state: '' }],
    ['responseTime', { responseTimeHours: 'unset' }],
  ] as ReadonlyArray<[string, Partial<FormState>]>)('reports %s', (key, patch) => {
    expect(liveBlockers({ ...COMPLETE, ...patch })).toContain(key);
  });

  it('treats whitespace as empty, so a space bar cannot satisfy a requirement', () => {
    expect(liveBlockers({ ...COMPLETE, city: '   ', state: '  ' })).toContain('location');
  });

  /*
   * The form judges its own fields so a dot can clear as the vendor types
   * rather than only after a save round-trip. It cannot see packages, which
   * live on another surface.
   */
  it('never claims to know about packages', () => {
    expect(liveBlockers({ ...COMPLETE, businessName: '' })).not.toContain('packages');
  });
});

describe('mergeBlockers', () => {
  it('keeps the server blockers the form cannot judge for itself', () => {
    expect(mergeBlockers([], ['packages'])).toEqual(['packages']);
  });

  /*
   * Without this the nav would keep a stale dot until the next save: the server
   * still reports the bio missing while the vendor is typing one.
   */
  it('drops a server blocker the vendor has already fixed in the form', () => {
    expect(mergeBlockers([], ['bio', 'packages'])).toEqual(['packages']);
  });

  it('does not double-count a blocker both sides report', () => {
    const merged = mergeBlockers(['bio'], ['bio', 'packages']);

    expect(merged.filter((key) => key === 'bio')).toHaveLength(1);
    expect(merged).toEqual(['bio', 'packages']);
  });

  it('puts the form blockers first, so the nearest fix reads first', () => {
    expect(mergeBlockers(['businessName', 'bio'], ['packages'])).toEqual([
      'businessName',
      'bio',
      'packages',
    ]);
  });
});

/**
 * Neither field gates publishing. A vendor who has not written a line, or who
 * would rather not say how long they have been working, is still publishable —
 * these two add to a profile, they do not certify one.
 */
describe('the tagline and the experience figure never block publishing', () => {
  it('publishes with neither answered', () => {
    expect(liveBlockers({ ...COMPLETE, tagline: '', yearsInBusiness: '' })).toEqual([]);
  });

  it('publishes with a vendor in their first year', () => {
    expect(liveBlockers({ ...COMPLETE, yearsInBusiness: '0' })).toEqual([]);
  });
});
