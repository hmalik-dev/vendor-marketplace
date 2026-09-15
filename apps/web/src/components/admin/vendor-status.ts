import type { AdminVendorStatus } from '@vendor-marketplace/shared';
import type { StatusTone } from '@/components/ui/status-pill';

/*
 * A plain module rather than part of `vendor-table.tsx`, which is a client
 * module: a Server Component importing a value from one receives a client
 * reference, not the object, and the vendor detail (VEN-380) pills with this.
 */

/**
 * The statuses frame `13` draws, mapped onto the shared pill vocabulary in
 * `03-components.md` rather than onto new colours. Every value here is a token
 * pair the frame already uses:
 *
 * | Status  | Frame fill / text   | Shared tone |
 * | ------- | ------------------- | ----------- |
 * | Live    | `#EDF0E9` `#4B5940` | `confirmed` |
 * | Review  | `#F5EEDC` `#7A5A12` | `pending`   |
 * | Flagged | `#F7E7E0` `#8E3F20` | `needsYou`  |
 * | Paused  | `#EFE9E0` `#6B6459` | `inert`     |
 *
 * `Retired` (#433) is the one the frame does not draw, because the state did
 * not exist when it was drawn. It takes `inert` — the same tone as `Paused`,
 * which is the frame's vocabulary for "this storefront is not trading" — and is
 * told apart by its label rather than by a fifth colour nobody specified. A new
 * token pair here would be inventing design, which is the plan's job and not
 * this ticket's.
 *
 * `Held` (#457) arrives the same way and takes the same route: `needsYou`, the
 * tone `Flagged` already spends, because both are the console saying *an
 * operator did this and only an operator can undo it*. Sharing a tone with the
 * other moderation state is the point — the pair a reader must not confuse is
 * `Held` and `Paused`, and those are now a colour apart where before they were
 * the same label.
 */
export const VENDOR_STATUS_TONES: Record<AdminVendorStatus, StatusTone> = {
  live: 'confirmed',
  review: 'pending',
  flagged: 'needsYou',
  paused: 'inert',
  held: 'needsYou',
  retired: 'inert',
};
