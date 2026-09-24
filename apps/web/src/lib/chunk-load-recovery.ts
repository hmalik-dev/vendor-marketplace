/**
 * A tab left open across a deploy asks for chunks the new build no longer
 * serves (VEN-610). Vercel's Hobby plan has no skew protection, so the failure
 * arrives as a `ChunkLoadError` in an error boundary. One reload fetches the
 * new build's document and its chunk names, which is the whole recovery.
 */
const CHUNK_RELOAD_FLAG = 'chunk-load-reloaded';

const CHUNK_FAILURE_MESSAGE = /Loading chunk .* failed/i;

/** Whether `error` is a lazy chunk that failed to load. */
export function isChunkLoadError(error: Error): boolean {
  return error.name === 'ChunkLoadError' || CHUNK_FAILURE_MESSAGE.test(error.message);
}

/**
 * Reloads the page once per browser session when `error` is a chunk failure,
 * and reports whether it did. The `sessionStorage` flag is what stops a chunk
 * that is genuinely missing from reloading forever: the second occurrence
 * returns `false` and the boundary renders its normal screen. Storage that
 * throws (a private window) counts as already reloaded, for the same reason.
 */
export function reloadOnceOnChunkError(error: Error): boolean {
  if (!isChunkLoadError(error)) {
    return false;
  }

  try {
    if (window.sessionStorage.getItem(CHUNK_RELOAD_FLAG) !== null) {
      return false;
    }

    window.sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
  } catch {
    // No storage means no way to bound the reload, so there is none.
    return false;
  }

  window.location.reload();

  return true;
}
