import { describe, expect, it } from 'vitest';
import { MAX_PAGE, MAX_PAGE_SIZE } from '../constants/index.js';
import { paginationQuerySchema, vendorSearchQuerySchema } from './index.js';

/**
 * The page window is defined once.
 *
 * `vendorSearchQuerySchema` restated `page` and `pageSize` rather than taking
 * them from `paginationQuerySchema`, and the copies drifted exactly as
 * duplicated definitions do: only one of them ever gained an upper bound on
 * `page`, so `?page=2147483648` cleared the search boundary, reached the DAO and
 * overflowed `int4` computing `(page - 1) * pageSize`. A 500 for a URL anyone
 * can paste.
 *
 * The defect is duplication, so these assert against duplication — that the two
 * are **the same object**, not two objects that happen to agree today. A test
 * comparing their behaviour would have passed all along, right up until someone
 * changed one of them.
 */
describe('the page window has one definition', () => {
  it('gives the search schema the pagination schema’s own field objects', () => {
    /*
      `.refine()` on an object keeps the object type in Zod v4 and adds a check,
      so the fields are reachable on `def.shape` directly rather than through a
      wrapper.
    */
    expect(vendorSearchQuerySchema.def.shape.page).toBe(paginationQuerySchema.shape.page);
    expect(vendorSearchQuerySchema.def.shape.pageSize).toBe(paginationQuerySchema.shape.pageSize);
  });

  it('bounds page above as well as below, in that one definition', () => {
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: MAX_PAGE }).success).toBe(true);
    expect(paginationQuerySchema.safeParse({ page: MAX_PAGE + 1 }).success).toBe(false);
  });

  /*
   * The bound exists to keep `(page - 1) * pageSize` inside `int4`, so the
   * assertion is about that product rather than about the constant's value —
   * raising `MAX_PAGE_SIZE` without revisiting `MAX_PAGE` is the change this
   * catches.
   */
  it('keeps the largest reachable offset inside int4', () => {
    const largestOffset = (MAX_PAGE - 1) * MAX_PAGE_SIZE;

    expect(largestOffset).toBeLessThan(2_147_483_647);
  });

  it('applies the same ceiling through the search schema', () => {
    const overTheTop = vendorSearchQuerySchema.safeParse({ page: String(MAX_PAGE + 1) });

    expect(overTheTop.success).toBe(false);
  });
});
