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
/** Head-room over the server-side wait before the request is abandoned. */
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

/** Mailosaur answers 404 when nothing matching arrived within the wait. */
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
  const query = new URLSearchParams({
    server,
    timeout: String(waitMs),
    errorOnTimeout: 'false',
  });

  if (request.after) {
    query.set('receivedAfter', request.after);
  }

  const call = async (path: string, init: RequestInit): Promise<unknown> => {
    let response: Response;

    try {
      response = await fetchImpl(`${MAIL_API_ORIGIN}${path}`, {
        ...init,
        headers: {
          authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(waitMs + ABORT_GRACE_MS),
      });
    } catch {
      throw new MailCodeError('The mail API did not answer in time.');
    }

    if (response.status === NO_MAIL_STATUS) {
      throw new MailCodeError(`No mail arrived for that address (mail API ${response.status}).`);
    }

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

  // Search waits for a match and lists summaries; the code is only in the full message.
  const found = (await call(`/api/messages/search?${query.toString()}`, {
    method: 'POST',
    body: JSON.stringify({ sentTo: address }),
  })) as { items?: { id?: unknown }[] } | null;
  const id = found?.items?.[0]?.id;

  if (typeof id !== 'string' || !MESSAGE_ID.test(id)) {
    throw new MailCodeError('No mail arrived for that address.');
  }

  const message = (await call(`/api/messages/${id}`, { method: 'GET' })) as MailMessage;

  const code = pickCode(message);

  if (!code) {
    throw new MailCodeError('The message carried no six-digit code.');
  }

  return code;
}
