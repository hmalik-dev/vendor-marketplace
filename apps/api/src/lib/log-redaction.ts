/** What replaces a query value in the log. */
const REDACTED = '[redacted]';

/**
 * What an ordinary parameter name looks like. A name outside this shape is
 * redacted too, because `?eyJhbGciOiJSUzI1NiIs…` with no `=` is a credential
 * sitting in the name position — keeping names verbatim would walk straight
 * past the leak this function exists to stop.
 */
const ORDINARY_NAME = /^[A-Za-z0-9_.-]{1,40}$/;

/**
 * Rewrites a request URL so the log keeps its shape and none of its values.
 *
 * #215 found session JWTs in the API's own log, because Fastify's request
 * logger writes the full URL and the event stream carried its token there.
 * Moving that credential out of the URL is the fix; this is the guard that
 * makes the same mistake harmless the next time, which is what the ticket
 * asks for — the logger must not be able to write a credential even if one
 * reaches a URL again.
 *
 * Every value goes, not a list of suspicious parameter names: the parameter
 * that leaks next is the one nobody thought to add to the list. The path and
 * the parameter names survive, which is the part a log is read for.
 *
 * Never throws. It runs on the request path, so a malformed query string must
 * cost a log line's detail rather than the request.
 */
export function redactQueryValues(url: string): string {
  const separator = url.indexOf('?');

  if (separator === -1) {
    return url;
  }

  const path = url.slice(0, separator);
  const query = url.slice(separator + 1);

  if (query === '') {
    return `${path}?`;
  }

  const redacted = query
    .split('&')
    .map((pair) => {
      if (pair === '') {
        return pair;
      }

      const equals = pair.indexOf('=');
      const name = equals === -1 ? pair : pair.slice(0, equals);

      return `${ORDINARY_NAME.test(name) ? name : REDACTED}=${REDACTED}`;
    })
    .join('&');

  return `${path}?${redacted}`;
}
