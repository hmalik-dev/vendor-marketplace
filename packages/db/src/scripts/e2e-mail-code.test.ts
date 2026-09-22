import { describe, expect, it, vi } from 'vitest';
import {
  MAX_WAIT_MS,
  MailCodeError,
  POLL_INTERVAL_MS,
  parseArgs,
  readMailCode,
} from './e2e-mail-code.js';

const KEY = 'sentinel-mail-key-value';
const SERVER = 'abc1de23';
const ADDRESS = `e2e-507-1@${SERVER}.mailosaur.net`;
const env = { E2E_MAIL_API_KEY: KEY, E2E_MAIL_SERVER: SERVER } as NodeJS.ProcessEnv;

const MESSAGE_ID = 'msg-1';

/** A 200 answers the search with one summary, then the fetch with `body`; any other status fails the search. */
function answer(status: number, body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string) =>
    status === 200 && url.includes('/api/messages/search')
      ? new Response(JSON.stringify({ items: [{ id: MESSAGE_ID }] }), { status })
      : new Response(JSON.stringify(body), { status }),
  );
}

function asFetch(mock: ReturnType<typeof vi.fn>): typeof fetch {
  return mock as unknown as typeof fetch;
}

async function failure(run: Promise<unknown>): Promise<MailCodeError> {
  try {
    await run;
  } catch (error) {
    return error as MailCodeError;
  }
  throw new Error('expected a refusal');
}

describe('readMailCode', () => {
  it('returns the six-digit code in the message and asks for that address only', async () => {
    const fetchMock = answer(200, { text: { body: 'Your code is 482913' } });

    const code = await readMailCode({ address: ADDRESS }, env, asFetch(fetchMock));

    expect(code).toBe('482913');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const headers = {
      authorization: `Basic ${Buffer.from(`${KEY}:`).toString('base64')}`,
      'content-type': 'application/json',
    };
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(init.method).toBe('POST');
    expect(parsed.origin + parsed.pathname).toBe('https://mailosaur.com/api/messages/search');
    expect([...parsed.searchParams.entries()]).toEqual([['server', SERVER]]);
    expect(init.body).toBe(JSON.stringify({ sentTo: ADDRESS }));
    expect(init.headers).toEqual(headers);
    const [fetchUrl, fetchInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(fetchUrl).toBe(`https://mailosaur.com/api/messages/${MESSAGE_ID}`);
    expect(fetchInit.method).toBe('GET');
    expect(fetchInit.headers).toEqual(headers);
  });

  it('reports no mail when the wait ends with nothing found', async () => {
    const empty = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));

    vi.useFakeTimers();
    try {
      const pending = failure(
        readMailCode({ address: ADDRESS, waitMs: 5_000 }, env, asFetch(empty)),
      );
      await vi.advanceTimersByTimeAsync(5_000);
      const error = await pending;

      expect(error.message).toBe('No mail arrived for that address.');
      // Polls at t=0,1500,3000,4500, plus one final check at the deadline (t=5000).
      expect(empty).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('finds the code that arrives partway through the wait, polling client-side', async () => {
    let searches = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (!url.includes('/api/messages/search')) {
        return new Response(JSON.stringify({ text: { body: 'Your code is 482913' } }), {
          status: 200,
        });
      }

      searches += 1;

      return searches < 3
        ? new Response(JSON.stringify({ items: [] }), { status: 200 })
        : new Response(JSON.stringify({ items: [{ id: MESSAGE_ID }] }), { status: 200 });
    });

    vi.useFakeTimers();
    try {
      const pending = readMailCode({ address: ADDRESS, waitMs: 10_000 }, env, asFetch(fetchMock));
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2);
      await expect(pending).resolves.toBe('482913');
      expect(searches).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('passes --after as receivedAfter and falls back to the subject', async () => {
    const fetchMock = answer(200, { subject: 'Code 123456', text: { body: 'no digits here' } });

    const code = await readMailCode(
      { address: ADDRESS, after: '2026-09-21T21:00:00.000Z' },
      env,
      asFetch(fetchMock),
    );

    expect(code).toBe('123456');
    const url = new URL((fetchMock.mock.calls[0] as [string])[0]);
    expect(url.searchParams.get('receivedAfter')).toBe('2026-09-21T21:00:00.000Z');
    expect(url.searchParams.has('sentTo')).toBe(false);
  });

  it('reads the code from an HTML-only message', async () => {
    const fetchMock = answer(200, { html: { body: '<p>Your code is <b>731904</b></p>' } });

    await expect(readMailCode({ address: ADDRESS }, env, asFetch(fetchMock))).resolves.toBe(
      '731904',
    );
  });

  it('refuses a message with no code without echoing its body', async () => {
    const error = await failure(
      readMailCode(
        { address: ADDRESS },
        env,
        asFetch(answer(200, { text: { body: 'secret reset link 12345' } })),
      ),
    );

    expect(error.message).toBe('The message carried no six-digit code.');
    expect(error.message).not.toContain('secret reset link');
  });

  it.each([
    ['another domain', 'someone@example.com'],
    ['another server', 'x@zzzz9999.mailosaur.net'],
    ['a subdomain', `x@evil.${SERVER}.mailosaur.net`],
    ['an empty address', ''],
    ['no local part', `@${SERVER}.mailosaur.net`],
    ['two at-signs', `a@b@${SERVER}.mailosaur.net`],
    ['a semicolon', `a;rm -rf x@${SERVER}.mailosaur.net`],
    ['a space', `a b@${SERVER}.mailosaur.net`],
    ['a dollar substitution', `$(id)@${SERVER}.mailosaur.net`],
  ])('refuses %s with no network call', async (_name, address) => {
    const fetchMock = answer(200, {});

    const error = await failure(readMailCode({ address }, env, asFetch(fetchMock)));

    expect(error).toBeInstanceOf(MailCodeError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(error.message).not.toContain(SERVER);
    expect(error.message).not.toContain(KEY);
  });

  it('fails naming E2E_MAIL_API_KEY when it is unset', async () => {
    const fetchMock = answer(200, {});

    const error = await failure(
      readMailCode(
        { address: ADDRESS },
        { E2E_MAIL_SERVER: SERVER } as NodeJS.ProcessEnv,
        asFetch(fetchMock),
      ),
    );

    expect(error.message).toBe('E2E_MAIL_API_KEY is not set.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails naming E2E_MAIL_SERVER when it is unset', async () => {
    const error = await failure(
      readMailCode(
        { address: ADDRESS },
        { E2E_MAIL_API_KEY: KEY } as NodeJS.ProcessEnv,
        asFetch(answer(200, {})),
      ),
    );

    expect(error.message).toBe('E2E_MAIL_SERVER is not set.');
    expect(error.message).not.toContain(KEY);
  });

  it.each(['production', 'staging', 'prod', 'LOCAL '])(
    'refuses DEPLOY_ENV=%s before reading the key',
    async (deployEnv) => {
      const fetchMock = answer(200, {});
      // A getter proves the key is never read, not merely never sent.
      const guarded = { E2E_MAIL_SERVER: SERVER, DEPLOY_ENV: deployEnv } as NodeJS.ProcessEnv;
      Object.defineProperty(guarded, 'E2E_MAIL_API_KEY', {
        get(): string {
          throw new Error('the key was read');
        },
      });

      const error = await failure(readMailCode({ address: ADDRESS }, guarded, asFetch(fetchMock)));

      expect(error.message).toBe('Refusing to run: DEPLOY_ENV is not local.');
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('runs when DEPLOY_ENV is local', async () => {
    const withLocal = { ...env, DEPLOY_ENV: 'local' } as NodeJS.ProcessEnv;

    await expect(
      readMailCode({ address: ADDRESS }, withLocal, asFetch(answer(200, { subject: '111222' }))),
    ).resolves.toBe('111222');
  });

  it('never carries the key or the server in an error, whatever the API answers', async () => {
    const leaky = answer(500, { error: `bad key ${KEY} on ${SERVER}` });
    const throwing = vi.fn(async () => {
      throw new Error(`socket for ${KEY} at ${SERVER}`);
    });

    for (const fetchImpl of [leaky, throwing]) {
      const error = await failure(readMailCode({ address: ADDRESS }, env, asFetch(fetchImpl)));

      expect(error.message).not.toContain(KEY);
      expect(error.message).not.toContain(SERVER);
    }
  });

  it('treats a 404 from search as nothing matched yet, and keeps polling to the deadline', async () => {
    const notFound = vi.fn(async () => new Response(JSON.stringify({}), { status: 404 }));

    vi.useFakeTimers();
    try {
      const pending = failure(
        readMailCode({ address: ADDRESS, waitMs: 5_000 }, env, asFetch(notFound)),
      );
      await vi.advanceTimersByTimeAsync(5_000);
      const error = await pending;

      expect(error.message).toBe('No mail arrived for that address.');
      expect(notFound).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tells a 400 from a 401 by status and Mailosaur message, and nothing else', async () => {
    const leak = `${KEY} ${SERVER} Your code is 482913`;
    const bad = await failure(
      readMailCode(
        { address: ADDRESS },
        env,
        asFetch(answer(400, { message: 'Invalid criteria', text: { body: leak } })),
      ),
    );
    const unauthorized = await failure(
      readMailCode(
        { address: ADDRESS },
        env,
        asFetch(answer(401, { message: 'Invalid API key', text: { body: leak } })),
      ),
    );

    expect(bad.message).toBe('The mail API refused the request (400): Invalid criteria');
    expect(unauthorized.message).toBe('The mail API refused the request (401): Invalid API key');
    for (const error of [bad, unauthorized]) {
      expect(error.message).not.toContain(KEY);
      expect(error.message).not.toContain(SERVER);
      expect(error.message).not.toContain('482913');
    }
  });

  it('drops a Mailosaur message that carries the key or the server', async () => {
    const error = await failure(
      readMailCode(
        { address: ADDRESS },
        env,
        asFetch(answer(401, { message: `bad key ${KEY} on ${SERVER}` })),
      ),
    );

    expect(error.message).toBe('The mail API refused the request (401).');
  });

  it('caps the requested wait, giving up at MAX_WAIT_MS rather than the requested wait', async () => {
    const empty = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));

    vi.useFakeTimers();
    try {
      const pending = failure(
        readMailCode({ address: ADDRESS, waitMs: 10 * MAX_WAIT_MS }, env, asFetch(empty)),
      );
      let settled = false;
      void pending.then(() => {
        settled = true;
      });

      // Just short of the cap: still polling, proving it did not give up at some smaller wait.
      await vi.advanceTimersByTimeAsync(MAX_WAIT_MS - POLL_INTERVAL_MS);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(2 * POLL_INTERVAL_MS);
      const error = await pending;

      expect(error.message).toBe('No mail arrived for that address.');
      // MAX_WAIT_MS / POLL_INTERVAL_MS polls plus the initial one, capped well short of the
      // requested 10x wait.
      expect(empty).toHaveBeenCalledTimes(MAX_WAIT_MS / POLL_INTERVAL_MS + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('abandons an API that never answers', async () => {
    const hanging = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error(`aborted ${KEY}`)));
        }),
    );
    vi.useFakeTimers();
    try {
      const pending = failure(
        readMailCode({ address: ADDRESS, waitMs: 1_000 }, env, asFetch(hanging)),
      );
      await vi.advanceTimersByTimeAsync(6_000);
      const error = await pending;

      expect(error.message).toBe('The mail API did not answer in time.');
      expect(error.message).not.toContain(KEY);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('parseArgs', () => {
  it('takes an address and an optional --after', () => {
    expect(parseArgs([ADDRESS])).toEqual({ address: ADDRESS });
    expect(parseArgs([ADDRESS, '--after', '2026-09-21T21:00:00Z'])).toEqual({
      address: ADDRESS,
      after: '2026-09-21T21:00:00.000Z',
    });
  });

  it.each([
    [[]],
    [['--after', 'x']],
    [[ADDRESS, '--after']],
    [[ADDRESS, '--after', 'nope']],
    [[ADDRESS, 'extra']],
    [[ADDRESS, '--after', '2026-09-21', 'more']],
  ])('rejects %j', (argv) => {
    expect(() => parseArgs(argv)).toThrow(MailCodeError);
  });
});
