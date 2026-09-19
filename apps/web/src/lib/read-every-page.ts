import { MAX_PAGE_SIZE } from '@vendor-marketplace/shared';

/**
 * The most pages one read will walk. A ceiling on a loop that ends when the API
 * runs out of rows, so a misbehaving endpoint cannot spin a server render
 * forever; ten thousand rows is far past any one account's history.
 */
const MAX_PAGES_WALKED = 100;

/**
 * Reads a paginated list to its end.
 *
 * Both booking lists were read as their first page only, so past 100 rows the
 * oldest requests and the nearest events fell off the page: a paid booking
 * rendered as `Awaiting payment` because its row was on page two (VEN-433). A
 * short page is the end of the list; a full one means there may be more.
 */
export async function readEveryPage<T>(readPage: (query: string) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = [];

  for (let page = 1; page <= MAX_PAGES_WALKED; page += 1) {
    const batch = await readPage(`?page=${page}&pageSize=${MAX_PAGE_SIZE}`);
    rows.push(...batch);

    if (batch.length < MAX_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}
