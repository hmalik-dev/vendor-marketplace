import { index, integer, pgTable, primaryKey, text, varchar } from 'drizzle-orm/pg-core';
import { usStateEnum } from './enums.js';

/**
 * Every US place the `City` field may suggest — **reference data, not
 * inventory**.
 *
 * #384 is the third user override of the design contract, and this table is
 * what carries it. The field used to be fed by `GET /vendors/cities`, a
 * preloaded list of the places that already had a published vendor, on the
 * reasoning that *"a picker offering somewhere with nobody in it is a picker
 * that guarantees an empty result"*. The user overrode that in as many words:
 * *"i currently want the city dropdown to function the way airbnb's 'where'
 * input functions. Do not preload and indicate how many vendors are in each
 * city.. users should be able to search for any city and see the results."*
 *
 * The reasoning the old design protected is **not discarded** — it is answered
 * somewhere else. A city with nobody in it now commits, searches, and lands on
 * the frame `18` no-results state with relaxations, which is the honest answer
 * the select could not give at all. What survives unchanged is that the pair is
 * still *chosen*, never typed: a suggestion is a row in this table, so
 * `lower(city) = $1` still has an exact value to match and a typo still commits
 * nothing.
 *
 * **Deliberately unrelated to `vendor_profiles`.** No foreign key, no count, no
 * join — a suggestion says a place exists, and says nothing whatever about who
 * is in it.
 */
/**
 * The widest place name the table accepts.
 *
 * Exported so the dataset's own test can assert against the column rather than
 * against a number retyped beside it — 45 characters is the longest today
 * (`Diamond Head / Kapahulu / Saint Louis Heights`), and a refresh that
 * introduced a longer one should fail in `us-cities.test.ts` rather than
 * mid-insert.
 */
export const US_CITY_NAME_MAX_LENGTH = 100;

export const usCities = pgTable(
  'us_cities',
  {
    /** As a person writes it: `Austin`, `Coeur d'Alene`, `Winston-Salem`. */
    name: varchar('name', { length: US_CITY_NAME_MAX_LENGTH }).notNull(),
    state: usStateEnum('state').notNull(),
    /**
     * The **ranking key, never a displayed number**.
     *
     * It replaces `vendorCount`'s third tier, which the user's instruction
     * removed both as a label and as an ordering signal. Population is the
     * honest generalisation of what that tier was for: it is what puts
     * `Portland, OR` above `Portland, ME` for someone who typed `portl`, and
     * `Arlington, VA` above `Arlington, MN`. It never reaches the browser —
     * `placeSuggestionSchema` carries `city` and `state` and nothing else — so
     * no number, invented or otherwise, lands on a public page.
     */
    population: integer('population').notNull().default(0),
    /**
     * `name` under `normaliseForMatch`: lowercased, diacritics stripped,
     * whitespace collapsed.
     *
     * Stored rather than computed per query so the prefix tier can use an
     * index, and so the seed and the API cannot disagree about what "matches"
     * means — they call the same shared function, one on the way in and one on
     * the way out.
     */
    searchName: text('search_name').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.name, table.state] }),
    /*
     * `text_pattern_ops` is what makes `search_name LIKE 'aus%'` an index scan
     * under a non-C collation; the default opclass cannot serve a prefix match
     * there. The substring tier that sits below it is a sequential scan by
     * construction, which is affordable only because the table is ~35k rows of
     * three short columns.
     */
    index('us_cities_search_name_prefix_idx').using(
      'btree',
      table.searchName.op('text_pattern_ops'),
    ),
  ],
);

export type UsCityRow = typeof usCities.$inferSelect;
export type NewUsCityRow = typeof usCities.$inferInsert;
