const SLASH = 47;

/**
 * `value` without its trailing slashes. An index scan rather than `/\/+$/`,
 * which retries from every slash in a run and so takes quadratic time on a long
 * run that does not end the string.
 */
export function trimTrailingSlashes(value: string): string {
  let end = value.length;

  while (end > 0 && value.charCodeAt(end - 1) === SLASH) {
    end -= 1;
  }

  return end === value.length ? value : value.slice(0, end);
}
