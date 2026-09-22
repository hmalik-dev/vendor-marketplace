/**
 * Reads the six-digit code dev Neon Auth mails to a disposable Mailosaur
 * address, so a lane never has to touch the mailbox key itself.
 *
 * Deliberately narrow, because it is the command an account holder allows by
 * name: it runs only off a deployment, only for `<local>@<server>.mailosaur.net`,
 * returns the code and never the message, and names a missing variable without
 * ever echoing a value. `fetch` is injected so the suite never reaches the
 * network.
 */

export const MAIL_API_ORIGIN = 'https://mailosaur.com';
export const DEFAULT_WAIT_MS = 60_000;
/** Never wait longer than this, whatever the caller asks. */
export const MAX_WAIT_MS = 120_000;
/** Mailosaur's search has no server-side wait; poll at this cadence instead. */
export const POLL_INTERVAL_MS = 1_500;
/** Head-room over a single request before it is abandoned as unanswered. */
const ABORT_GRACE_MS = 5_000;

/** Longest Mailosaur error message printed. */
const MAX_REASON_LENGTH = 200;

const KEY_VARIABLE = 'E2E_MAIL_API_KEY';
const SERVER_VARIABLE = 'E2E_MAIL_SERVER';
const SERVER_ID = /^[a-z0-9]+$/;
const MESSAGE_ID = /^[a-z0-9-]+$/i;
const LOCAL_PART = /^[a-z0-9._+-]+$/i;
const CODE = /(?<!\d)\d{6}(?!\d)/;

interface MailPart {
  body?: unknown;
  codes?: unknown;
}

interface MailMessage {
  subject?: unknown;
  text?: MailPart;
  html?: MailPart;
}

export interface MailCodeRequest {
  address: string;
  /** ISO timestamp; mail received before it is ignored. */
  after?: string;
  waitMs?: number;
}

/** A refusal whose message is safe to print: it names variables, never values. */
export class MailCodeError extends Error {}

/** Splits `<address> [--after <iso>]` and rejects anything else. */
export function parseArgs(argv: readonly string[]): MailCodeRequest {
  const usage = new MailCodeError('Usage: e2e:mail-code <address> [--after <iso>]');
  const [address, flag, after, ...rest] = argv;

  if (address === undefined || address.startsWith('--') || rest.length > 0) {
    throw usage;
  }

  if (flag === undefined) {
    return { address };
  }

  if (flag !== '--after' || after === undefined || Number.isNaN(Date.parse(after))) {
    throw usage;
  }

  return { address, after: new Date(after).toISOString() };
}

function codeIn(part: MailPart | undefined): string | null {
  const body = typeof part?.body === 'string' ? part.body : '';
  const codes = Array.isArray(part?.codes) ? (part.codes as unknown[]) : [];
  const listed = codes
    .map((entry) => (entry as { value?: unknown } | null)?.value)
    .find((value): value is string => typeof value === 'string' && CODE.test(value));

  return CODE.exec(body)?.[0] ?? listed ?? null;
}

function pickCode(message: MailMessage): string | null {
  const subject = typeof message.subject === 'string' ? message.subject : '';

  // Plain text wins, then the HTML part (a mail may carry only one), then the subject.
  return codeIn(message.text) ?? codeIn(message.html) ?? CODE.exec(subject)?.[0] ?? null;
}

/** A 404 from search means nothing matched at this poll; treated as no match, not a refusal. */
const NO_MAIL_STATUS = 404;

/**
 * Mailosaur's own `message` field from an error answer, or null when it is
 * absent or would echo a secret. Nothing else in the body is ever returned.
 */
async function apiMessage(response: Response, secrets: readonly string[]): Promise<string | null> {
  try {
    const { message } = (await response.json()) as { message?: unknown };

    if (typeof message !== 'string' || secrets.some((secret) => message.includes(secret))) {
      return null;
    }

    return message.trim().slice(0, MAX_REASON_LENGTH) || null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The six-digit code in the newest mail to `address`. Throws a
 * {@link MailCodeError} on any refusal or failure.
 */
export async function readMailCode(
  request: MailCodeRequest,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const deployEnv = env.DEPLOY_ENV?.trim() || 'local';

  if (deployEnv !== 'local') {
    throw new MailCodeError('Refusing to run: DEPLOY_ENV is not local.');
  }

  const server = env[SERVER_VARIABLE]?.trim().toLowerCase();

  if (!server) {
    throw new MailCodeError(`${SERVER_VARIABLE} is not set.`);
  }

  if (!SERVER_ID.test(server)) {
    throw new MailCodeError(`${SERVER_VARIABLE} is not a Mailosaur server id.`);
  }

  const address = request.address.toLowerCase();
  const [localPart, domain, ...extra] = address.split('@');

  if (
    !localPart ||
    !LOCAL_PART.test(localPart) ||
    extra.length > 0 ||
    domain !== `${server}.mailosaur.net`
  ) {
    throw new MailCodeError(`Refusing an address outside @${SERVER_VARIABLE}.mailosaur.net.`);
  }

  const key = env[KEY_VARIABLE];

  if (!key) {
    throw new MailCodeError(`${KEY_VARIABLE} is not set.`);
  }

  const waitMs = Math.min(request.waitMs ?? DEFAULT_WAIT_MS, MAX_WAIT_MS);
  const deadline = Date.now() + waitMs;
  const remaining = (): number => Math.max(deadline - Date.now(), 0);
  const query = new URLSearchParams({ server });

  if (request.after) {
    query.set('receivedAfter', request.after);
  }

  const send = async (path: string, init: RequestInit): Promise<Response> => {
    try {
      return await fetchImpl(`${MAIL_API_ORIGIN}${path}`, {
        ...init,
        headers: {
          authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(remaining() + ABORT_GRACE_MS),
      });
    } catch {
      throw new MailCodeError('The mail API did not answer in time.');
    }
  };

  // Parses a non-404 answer; a refusal here is a genuine API problem (bad
  // key, malformed request), never "no mail yet", so it fails immediately
  // rather than being retried away like a 404 from search is below.
  const parse = async (response: Response): Promise<unknown> => {
    if (!response.ok) {
      const reason = await apiMessage(response, [key, server]);

      throw new MailCodeError(
        `The mail API refused the request (${response.status})${reason ? `: ${reason}` : '.'}`,
      );
    }

    try {
      return await response.json();
    } catch {
      throw new MailCodeError('The mail API answered with a malformed message.');
    }
  };

  // Mailosaur's search answers immediately with whatever already matches; it
  // does not wait server-side, so a match that has not landed yet means
  // polling client-side until it does or the deadline passes. A 404 here
  // means nothing matched yet, same as an empty result — it is retried, not
  // treated as a refusal.
  const search = async (): Promise<string | null> => {
    const response = await send(`/api/messages/search?${query.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ sentTo: address }),
    });

    if (response.status === NO_MAIL_STATUS) {
      return null;
    }

    const found = (await parse(response)) as { items?: { id?: unknown }[] } | null;
    const id = found?.items?.[0]?.id;

    return typeof id === 'string' && MESSAGE_ID.test(id) ? id : null;
  };

  let id = await search();

  while (!id && Date.now() < deadline) {
    await sleep(Math.min(POLL_INTERVAL_MS, remaining()));
    id = await search();
  }

  if (!id) {
    throw new MailCodeError('No mail arrived for that address.');
  }

  const message = (await parse(
    await send(`/api/messages/${id}`, { method: 'GET' }),
  )) as MailMessage;

  const code = pickCode(message);

  if (!code) {
    throw new MailCodeError('The message carried no six-digit code.');
  }

  return code;
}
