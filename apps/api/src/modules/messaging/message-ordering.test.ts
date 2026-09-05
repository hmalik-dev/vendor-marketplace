import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The two orderings #402 depends on, asserted as source rather than behaviour.
 *
 * Both carry a second sort key on `id`, and both doc comments make a
 * load-bearing claim about it: without one a row can appear on two pages and
 * another on none, and the list preview can pick a different message on every
 * render. Neither claim can be *driven* here — Postgres gives no ordering
 * guarantee for tied keys, but it does not go out of its way to be arbitrary
 * either, so a small table returns the same order with or without the
 * tie-break and the behavioural test passes against the broken version. It is
 * a plan change at volume that produces the reordering, and that is not
 * reproducible in a test database.
 *
 * `04-laws.md`'s rule for exactly this: where a check cannot fail, assert the
 * class-level fact and say so. Owed and named beats faked. The behavioural
 * tests beside this one stay, because they would catch an ordering that broke
 * for any *other* reason; this is what catches the tie-break being deleted.
 */
describe('thread ordering carries a tie-break', () => {
  const source = readFileSync(join(import.meta.dirname, 'messaging.dao.ts'), 'utf8');

  it('pages a thread by created_at and then by id', () => {
    expect(source).toContain('.orderBy(desc(messages.createdAt), desc(messages.id))');
  });

  it('picks the list preview by created_at and then by id', () => {
    expect(source).toMatch(/order by newest\.created_at desc, newest\.id desc/);
  });
});
