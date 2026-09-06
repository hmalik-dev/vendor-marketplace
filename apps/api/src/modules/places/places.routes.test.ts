import { seedUsCities } from '@vendor-marketplace/db';
import { normaliseForMatch } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';

/**
 * `GET /places` — the `City` field's suggestions since #384.
 *
 * These drive the route rather than the DAO, because the querystring schema is
 * half the contract: the endpoint that answers a *required* `q` is what makes
 * "do not preload" enforceable rather than a convention the caller remembers.
 *
 * The fixture is a handful of hand-written places rather than the committed
 * 35,618, and deliberately: the dataset's own shape is asserted without a
 * database in `packages/db`, and these are about matching and ordering, which a
 * dozen rows exercise exactly as well and ~3s faster.
 */
describe('GET /places', () => {
  let harness: TestHarness;

  const place = (name: string, state: string, population: number) => ({
    name,
    state: state as 'TX',
    population,
    searchName: normaliseForMatch(name),
  });

  const PLACES = [
    place('Austin', 'TX', 993_588),
    place('Austin', 'MN', 26_690),
    place('Portland', 'OR', 652_503),
    place('Portland', 'ME', 66_881),
    place('Springfield', 'IL', 112_949),
    place('San José', 'CA', 969_655),
    place('Round Rock', 'TX', 126_431),
    // A substring-only match for `aus`: it is in the label, not at its start.
    place('Wausau', 'WI', 39_994),
  ];

  const labels = (body: { city: string; state: string }[]): string[] =>
    body.map((row) => `${row.city}, ${row.state}`);

  async function places(query: string): Promise<{ city: string; state: string }[]> {
    const response = await harness.app.inject({ method: 'GET', url: `/places?q=${query}` });
    expect(response.statusCode).toBe(200);
    return response.json();
  }

  beforeAll(async () => {
    harness = await createTestHarness();
    await seedUsCities(harness.database.db, PLACES);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('suggests a city whether or not a vendor has published there', async () => {
    /*
     * The whole point of the ticket, in one assertion. No vendor exists at all
     * in this harness, and `Springfield, IL` is offered anyway — where the
     * endpoint this replaced could only ever return places that already had
     * one.
     */
    expect(labels(await places('springf'))).toEqual(['Springfield, IL']);
  });

  it('ranks a prefix match above a merely-contained one', async () => {
    const found = labels(await places('aus'));

    expect(found[0]).toBe('Austin, TX');
    expect(found).toContain('Wausau, WI');
    expect(found.indexOf('Austin, MN')).toBeLessThan(found.indexOf('Wausau, WI'));
  });

  it('puts the more populous of two same-named cities first, and names both states', async () => {
    // The tie-break #384 ruled in place of `vendorCount`. Both rows are real
    // and neither is wrong, so the one more people mean leads — and each one
    // says which it is, because "Portland" alone names two places.
    expect(labels(await places('portl'))).toEqual(['Portland, OR', 'Portland, ME']);
  });

  it('matches the state through the comma the label draws', async () => {
    expect(labels(await places('austin%2C%20mn'))).toEqual(['Austin, MN']);
  });

  it('matches without diacritics, in both directions', async () => {
    expect(labels(await places('san jose'))).toEqual(['San José, CA']);
    expect(labels(await places('san%20jos%C3%A9'))).toEqual(['San José, CA']);
  });

  it('returns nothing for a place that does not exist rather than guessing', async () => {
    expect(await places('sprngfield')).toEqual([]);
  });

  /*
   * `%` and `_` are `LIKE` syntax. Unescaped, a lone `%` returns the whole
   * country — which is exactly the preloaded list this ticket removed, handed
   * back by the endpoint that replaced it.
   */
  it('treats LIKE wildcards as literal text', async () => {
    expect(await places('%25')).toEqual([]);
    expect(await places('a%25')).toEqual([]);
    expect(labels(await places('austi_'))).toEqual([]);
  });

  it('refuses a request with no query rather than answering with everything', async () => {
    for (const url of ['/places', '/places?q=']) {
      const response = await harness.app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(400);
    }
  });

  it('answers nothing for whitespace, without reaching the database for it', async () => {
    expect(await places('%20%20')).toEqual([]);
  });

  it('is reachable unauthenticated, since the search bar is on every public page', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/places?q=austin' });

    expect(response.statusCode).toBe(200);
  });

  it('never returns a count of anything — the shape is the pair and only the pair', async () => {
    // The user's instruction was that the field must not indicate how many
    // vendors are in a city. `population` is a ranking key, and this is what
    // stops it becoming a display one by accident.
    const [first] = await places('austin');

    expect(Object.keys(first ?? {}).sort()).toEqual(['city', 'state']);
  });

  /*
   * The DAO takes the indexed prefix query alone when it fills the page, and
   * falls through to the combined two-tier query when it does not — see its own
   * note for why that is equivalent rather than approximate. This is the seam
   * where an equivalence argument could quietly stop being true, so it is
   * asserted from both sides of it with the same data.
   */
  describe('the prefix fast path and the combined query agree', () => {
    // Nine `Lakeview N, TX` places plus one `North Lakeview`: `lakeview` has
    // more than a page of prefix matches, `north lakeview` has one and no
    // prefix match at all, and `lakeview 1` has exactly one of each.
    const LAKEVIEWS = [
      ...Array.from({ length: 9 }, (_, at) => place(`Lakeview ${at}`, 'TX', 9 - at)),
      place('North Lakeview', 'TX', 500),
    ];

    beforeAll(async () => {
      await seedUsCities(harness.database.db, LAKEVIEWS);
    });

    it('takes the fast path when prefix matches fill the page, and excludes the substring one', async () => {
      const found = labels(await places('lakeview'));

      expect(found).toHaveLength(8);
      // Population descending inside the tier, and `North Lakeview` — a
      // substring match with a much larger population — must not jump the tier.
      expect(found).toEqual([
        'Lakeview 0, TX',
        'Lakeview 1, TX',
        'Lakeview 2, TX',
        'Lakeview 3, TX',
        'Lakeview 4, TX',
        'Lakeview 5, TX',
        'Lakeview 6, TX',
        'Lakeview 7, TX',
      ]);
      expect(found).not.toContain('North Lakeview, TX');
    });

    it('falls through and interleaves the tiers when the prefix tier under-fills', async () => {
      // Two prefix matches and one substring-only match, which is fewer than a
      // page — so the fast path cannot answer and the combined query runs. The
      // ordering across the seam is the whole assertion: both `Austin`s, by
      // population, and only then `Wausau`, whatever its population.
      expect(labels(await places('aus'))).toEqual(['Austin, TX', 'Austin, MN', 'Wausau, WI']);
    });
  });

  it('caps what it returns so the panel cannot be handed a scroll list', async () => {
    const many = Array.from({ length: 20 }, (_, at) => place(`Lakeview ${at}`, 'TX', at));
    await seedUsCities(harness.database.db, many);

    expect((await places('lakeview')).length).toBe(8);
  });
});
