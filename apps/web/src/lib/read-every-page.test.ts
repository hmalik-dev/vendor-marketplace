import { describe, expect, it, vi } from 'vitest';
import { MAX_PAGE_SIZE } from '@vendor-marketplace/shared';
import { readEveryPage } from './read-every-page';

/** A list of `total` numbered rows, served the way the API pages it. */
function servePagesOf(
  total: number,
): ReturnType<typeof vi.fn<(query: string) => Promise<number[]>>> {
  return vi.fn(async (query: string) => {
    const params = new URLSearchParams(query);
    const page = Number(params.get('page'));
    const size = Number(params.get('pageSize'));
    const start = (page - 1) * size;

    return Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => start + i);
  });
}

describe('readEveryPage', () => {
  it('walks past the first hundred rows to the last one', async () => {
    const read = servePagesOf(2 * MAX_PAGE_SIZE + 1);

    const rows = await readEveryPage(read);

    expect(rows).toHaveLength(2 * MAX_PAGE_SIZE + 1);
    expect(rows.at(-1)).toBe(2 * MAX_PAGE_SIZE);
    expect(read.mock.calls.map(([query]) => query)).toEqual([
      `?page=1&pageSize=${MAX_PAGE_SIZE}`,
      `?page=2&pageSize=${MAX_PAGE_SIZE}`,
      `?page=3&pageSize=${MAX_PAGE_SIZE}`,
    ]);
  });

  it('stops at a short page without asking for another', async () => {
    const read = servePagesOf(3);

    expect(await readEveryPage(read)).toEqual([0, 1, 2]);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('asks once more after an exactly full last page and finds it empty', async () => {
    const read = servePagesOf(MAX_PAGE_SIZE);

    expect(await readEveryPage(read)).toHaveLength(MAX_PAGE_SIZE);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
