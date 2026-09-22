/*
 * The vendor gate (VEN-406): while `platform_settings.vendorInviteOnly` is on,
 * a vendor account is created only for an address the operator has invited.
 * Customers are never gated.
 */

/**
 * The retired free-text application route. Kept only as a redirect for old
 * links (VEN-512): the gate now sends an un-invited vendor straight to
 * {@link VENDOR_DETAILS_PATH}.
 */
export const VENDOR_APPLY_PATH = '/vendors/apply';

/**
 * Where a verified vendor session with no invite lands, gate on: the details
 * the operator needs to invite them (VEN-512). Their waitlist row is written
 * the moment they arrive.
 */
export const VENDOR_DETAILS_PATH = '/sign-up/vendor-details';

/** The waitlist's terminal screen: nothing to do until the operator invites them. */
export const WAITLIST_PATH = '/waitlist';

/** Where an invite email sends the invitee: sign-up with the vendor card pre-selected. */
export const VENDOR_SIGN_UP_PATH = '/sign-up?role=vendor';

/**
 * Storefront slugs a vendor can never be given, because a static route under
 * `/vendors/` answers that URL first and the storefront would be unreachable.
 */
export const RESERVED_VENDOR_SLUGS = ['apply'] as const;

/** Where one application on the waitlist stands. */
export const VENDOR_APPLICATION_STATUSES = ['new', 'invited', 'declined'] as const;
export type VendorApplicationStatus = (typeof VENDOR_APPLICATION_STATUSES)[number];

/** What an operator can decide about an application. */
export const VENDOR_APPLICATION_DECISIONS = ['invite', 'decline'] as const;
export type VendorApplicationDecision = (typeof VENDOR_APPLICATION_DECISIONS)[number];

/** Upper bound on the free-text note an applicant leaves. */
export const MAX_VENDOR_APPLICATION_MESSAGE_LENGTH = 2_000;
