import {
  ADMIN_ACTION_SUBJECTS,
  ADMIN_ACTIONS,
  ADMIN_ACTIVITY_RANGES,
  ADMIN_CASE_BOOKING_FILTERS,
  SUPPORT_CASE_STATUSES,
} from '@vendor-marketplace/shared';
import { boundedText, oneOf, uuidParam, type RawParam } from '@/lib/admin-params';

/**
 * The filters of the two lists whose page and `Export CSV` handler must narrow
 * the URL identically (VEN-388). One function per list, so the file an
 * admin downloads cannot be filtered differently from the table they were
 * looking at. `page` is not here: an export walks every page.
 */

export function activityParams(raw: Partial<Record<string, RawParam>>) {
  return {
    actor: uuidParam(raw.actor),
    subjectType: oneOf(raw.subjectType, ADMIN_ACTION_SUBJECTS),
    range: oneOf(raw.range, ADMIN_ACTIVITY_RANGES),
    action: oneOf(raw.action, ADMIN_ACTIONS),
    subject: uuidParam(raw.subject),
  };
}

export function caseParams(raw: Partial<Record<string, RawParam>>) {
  return {
    q: boundedText(raw.q),
    status: oneOf(raw.status, SUPPORT_CASE_STATUSES),
    booking: oneOf(raw.booking, ADMIN_CASE_BOOKING_FILTERS),
  };
}
