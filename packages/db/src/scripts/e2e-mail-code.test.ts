import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WAIT_MS,
  MAX_WAIT_MS,
  MailCodeError,
  parseArgs,
  readMailCode,
} from './e2e-mail-code.js';

const KEY = 'sentinel-mail-key-value';
const SERVER = 'abc1de23';
const ADDRESS = `e2e-507-1@${SERVER}.mailosaur.net`;
const env = { E2E_MAIL_API_KEY: KEY, E2E_MAIL_SERVER: SERVER } as NodeJS.ProcessEnv;

function answer(status: number, body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
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
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://mailosaur.com/api/messages/await');
    expect(parsed.searchParams.get('sentTo')).toBe(ADDRESS);
    expect(parsed.searchParams.get('server')).toBe(SERVER);
    expect(parsed.searchParams.get('timeout')).toBe(String(DEFAULT_WAIT_MS));
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from(`${KEY}:`).toString('base64')}`,
    );
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

  it('turns a 404 (no mail in time) into a plain refusal', async () => {
    const error = await failure(readMailCode({ address: ADDRESS }, env, asFetch(answer(404, {}))));

    expect(error.message).toBe('No mail arrived for that address (mail API 404).');
  });

  it('caps the requested wait', async () => {
    const capped = answer(200, { subject: '654321' });

    await readMailCode({ address: ADDRESS, waitMs: 10 * MAX_WAIT_MS }, env, asFetch(capped));

    const url = new URL((capped.mock.calls[0] as [string])[0]);
    expect(url.searchParams.get('timeout')).toBe(String(MAX_WAIT_MS));
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
