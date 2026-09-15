const TIMEOUT_MS = 15_000;

export interface HttpReply {
  readonly status: number;
  readonly headers: Headers;
  /** The parsed JSON body, or `null` when the body is not JSON. */
  readonly body: unknown;
}

/**
 * The only way a launch check reaches a provider. There is no method
 * parameter: the check is read-only by construction, not by discipline.
 */
export type HttpGet = (
  url: string,
  headers?: Readonly<Record<string, string>>,
) => Promise<HttpReply>;

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function readOnlyGet(fetchImpl: Fetch = fetch): HttpGet {
  return async (url, headers = {}) => {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    return {
      status: response.status,
      headers: response.headers,
      body: parseJson(await response.text()),
    };
  };
}

export function bearer(token: string | undefined): Record<string, string> {
  return { Authorization: `Bearer ${token ?? ''}` };
}

/** Reads a nested field from an untyped JSON body; `undefined` when any step is missing. */
export function field(value: unknown, ...path: readonly string[]): unknown {
  let current = value;

  for (const key of path) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
