import type { PriceType } from '@vendor-marketplace/shared';

/**
 * How each `price_type` is written for a person.
 *
 * Here rather than in the editor that first needed it: the public profile
 * renders the same labels on the server, and importing them from a client form
 * would pull that whole component into a page that never uses it.
 */
export const PRICE_TYPE_LABELS: Record<PriceType, string> = {
  fixed: 'Fixed price',
  starting_at: 'Starting at',
  hourly: 'Per hour',
};
