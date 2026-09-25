const READABLE_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * "December 19", not `2026-12-19`.
 *
 * Copy is read by a person, and an ISO date in it is a stored value leaking
 * into it — the same class of defect as rendering a row id. Notifications and
 * refusals both name a day this way.
 */
export function readableDate(date: string): string {
  return READABLE_DATE.format(new Date(`${date}T00:00:00Z`));
}
