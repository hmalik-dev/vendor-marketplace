/**
 * `Promise.all` with a ceiling, preserving input order.
 *
 * `Promise.all` over a list starts every chain at once, which is fine for a
 * handful of reads and wrong for anything that writes. The expiry sweep behind
 * `GET /booking-requests` was the case that found it: one chain per expired
 * request, each of them four statements and a notification write, all opened
 * together against a pool sized for a handful (#408).
 *
 * Workers pull from a shared cursor rather than the input being sliced into
 * fixed batches: a batch runs at the speed of its slowest member, and expiry is
 * exactly the shape where one row does four writes and the next does nothing.
 *
 * Rejection behaves as `Promise.all` does — the first one wins and the rest are
 * abandoned in place — so a caller that must not fail on one item handles that
 * inside `work`, where the item it belongs to is still in scope.
 */
export async function mapWithConcurrency<In, Out>(
  items: readonly In[],
  limit: number,
  work: (item: In) => Promise<Out>,
): Promise<Out[]> {
  const results = new Array<Out>(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await work(items[index] as In);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}
