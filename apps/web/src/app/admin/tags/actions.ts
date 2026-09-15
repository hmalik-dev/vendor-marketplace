'use server';

import { revalidateTag } from 'next/cache';
import { requireRole } from '@/lib/current-user';
import { CATEGORIES_CACHE_TAG } from '@/lib/vendor-data';

/**
 * Expires the shared taxonomy read after a console category write (VEN-401).
 *
 * The API reads categories at request time; the web server caches that read
 * for an hour, so without this a deactivated category would stay on the
 * landing pills and the search rail until the window ran out. `admin` only,
 * like the write it follows — the role check redirects anyone else.
 */
export async function expirePublicCategories(): Promise<void> {
  await requireRole('admin');
  revalidateTag(CATEGORIES_CACHE_TAG);
}
