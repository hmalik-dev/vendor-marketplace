import { normaliseForMatch, US_STATE_CODES, type UsStateCode } from '@vendor-marketplace/shared';
import type { NewUsCityRow } from './schema/us-cities.js';

const STATES = new Set<string>(US_STATE_CODES);

/**
 * A row of the dataset with every field present.
 *
 * `NewUsCityRow` makes `population` optional because the column has a default,
 * which is right for an insert and wrong for the parsed dataset: every row here
 * carries a population, and a test asserting on one should not have to prove it
 * is there first.
 */
export type UsCitySeedRow = Required<
  Pick<NewUsCityRow, 'name' | 'state' | 'population' | 'searchName'>
>;

/**
 * The committed dataset, parsed into rows the seed can insert.
 *
 * Parsing here rather than in the seed so the shape has one owner and a test
 * can assert the dataset's own invariants — every state closed, every name
 * short enough for the column, no duplicate pair — without a database.
 *
 * `searchName` is computed with the **shared** `normaliseForMatch`, the same
 * function the API applies to the customer's typed query. That is the whole
 * reason the column is stored rather than derived in SQL: two normalisers that
 * drift apart is a city a customer can see and cannot find, and the failure is
 * silent on both sides.
 *
 * **Async only so the dataset can be imported dynamically**, and that is not a
 * micro-optimisation. `packages/db`'s barrel re-exports `seedUsCities`, and
 * `apps/api` imports `createDatabase` from that barrel — so a static import
 * here would parse 612KB into ~1.2MB of heap in every API server process and
 * every API test worker, none of which ever calls this. It is the same cost the
 * seed split in `seed.ts` was drawn to avoid, one level up.
 */
export async function usCityRows(): Promise<UsCitySeedRow[]> {
  const { US_CITY_TSV } = await import('./us-cities-data.js');
  const rows: UsCitySeedRow[] = [];

  for (const line of US_CITY_TSV.split('\n')) {
    if (line === '') {
      continue;
    }

    const [name = '', state = '', population = ''] = line.split('\t');
    if (name === '' || !STATES.has(state)) {
      throw new Error(`us-cities-data.ts carries an unusable row: ${JSON.stringify(line)}`);
    }

    rows.push({
      name,
      state: state as UsStateCode,
      population: Number.parseInt(population, 10) || 0,
      searchName: normaliseForMatch(name),
    });
  }

  return rows;
}
