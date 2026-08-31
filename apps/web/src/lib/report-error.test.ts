import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportSwallowedError } from './report-error';

describe('reportSwallowedError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the context and the error to the console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('Too many requests');

    reportSwallowedError('search: /vendors request failed', failure);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('[swallowed] search: /vendors request failed', failure);
  });

  /*
   * The case that would have made this channel worthless. The search box aborts
   * an in-flight request on every keystroke, so logging aborts would fire
   * constantly on ordinary typing and train everyone — human and agent — to
   * ignore the one message that matters.
   */
  it('stays quiet on an abort, which is not a failure', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    reportSwallowedError('search', new DOMException('The operation was aborted.', 'AbortError'));
    reportSwallowedError('search', new DOMException('Timed out.', 'TimeoutError'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a DOMException that is not an abort', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new DOMException('Boom', 'NetworkError');

    reportSwallowedError('search', failure);

    expect(spy).toHaveBeenCalledWith('[swallowed] search', failure);
  });

  it('reports a non-Error rejection rather than dropping it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    reportSwallowedError('search', 'plain string rejection');

    expect(spy).toHaveBeenCalledWith('[swallowed] search', 'plain string rejection');
  });
});
