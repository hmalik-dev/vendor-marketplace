import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  decimal,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { usStateEnum } from './enums.js';
import { users } from './users.js';

export const vendorProfiles = pgTable(
  'vendor_profiles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    businessName: varchar('business_name', { length: 200 }).notNull(),
    /** URL-safe, auto-generated from the business name, vendor-editable. */
    slug: varchar('slug', { length: 200 }).notNull(),
    bio: text('bio'),
    /**
     * The vendor's own one-line description of their work, opening the About
     * tab as a pull-quote.
     *
     * Capped at 80 because that is roughly frame `03`'s line, and a hard cap is
     * what stops it becoming a second bio. Optional, and never a publish
     * blocker: a vendor without one simply gets no pull-quote.
     */
    tagline: varchar('tagline', { length: 80 }),
    /**
     * Self-declared years in business, for the Experience stat tile.
     *
     * Deliberately not derived from the first completed booking: that is wrong
     * for an established vendor joining today, which is most of the first
     * cohort. Unverifiable, but honest about being the vendor's own claim, and
     * consistent with the other two tiles, which are already vendor-entered.
     */
    yearsInBusiness: integer('years_in_business'),
    profileImageUrl: varchar('profile_image_url', { length: 500 }),
    coverImageUrl: varchar('cover_image_url', { length: 500 }),
    address: varchar('address', { length: 500 }),
    city: varchar('city', { length: 100 }),
    state: usStateEnum('state'),
    latitude: decimal('latitude', { precision: 10, scale: 8 }),
    longitude: decimal('longitude', { precision: 11, scale: 8 }),
    /**
     * The radius the vendor covers with no travel fee. Beyond it they either
     * decline the booking or quote a fee, which is what
     * `travelsBeyondRadius` records — a customer search for "vendors who cover
     * my area at no extra cost" is exactly this radius.
     */
    serviceRadiusKm: integer('service_radius_km').default(50),
    travelsBeyondRadius: boolean('travels_beyond_radius').notNull().default(false),
    responseTimeHours: integer('response_time_hours'),
    /** Stripe Connect Express account (ticket #9). */
    stripeAccountId: varchar('stripe_account_id', { length: 255 }),
    /**
     * Onboarding completed for `stripeAccountId`. **Cannot be true without
     * one** — see `vendor_profiles_stripe_onboarded_requires_account` below.
     */
    stripeOnboarded: boolean('stripe_onboarded').notNull().default(false),
    /** Vendor-controlled public visibility. */
    isPublished: boolean('is_published').notNull().default(false),
    /** Soft delete — preserves booking history integrity. */
    isDeleted: boolean('is_deleted').notNull().default(false),
    /** Derived from reviews; never written directly by an endpoint. */
    avgRating: decimal('avg_rating', { precision: 3, scale: 2 }).notNull().default('0'),
    /** Derived from reviews; never written directly by an endpoint. */
    reviewCount: integer('review_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('vendor_profiles_user_id_key').on(table.userId),
    uniqueIndex('vendor_profiles_slug_key').on(table.slug),
    index('vendor_profiles_published_idx').on(table.isPublished, table.isDeleted),
    // Location filtering only ever runs over publicly visible vendors.
    index('vendor_profiles_city_state_idx')
      .on(table.city, table.state)
      .where(sql`${table.isPublished} = true AND ${table.isDeleted} = false`),
    /*
     * Onboarded implies an account id. #381.
     *
     * The pair was writable in either order and one half was written alone,
     * which produced a row two surfaces answered opposite questions about.
     * `openCheckout` refuses a vendor with no account id with a deliberate
     * **402** — that guard is correct and stays — but the web app folds 402
     * into `null` and the page turns `null` into `notFound()`, so a customer
     * pressing `Pay` on an accepted booking was told **404 · NOT FOUND**, "the
     * link may be old, or a vendor may have taken their listing down", every
     * word of which was false. Meanwhile `admin.dao.ts`'s `Payouts: connected`
     * filter reads `stripeOnboarded` alone and reported that same vendor as
     * connected.
     *
     * Enforced here rather than in the DAOs because the writes come from four
     * places — the Connect service, the account webhook, two seeds — and a rule
     * kept in application code is one each new writer has to remember. The
     * constraint is also what makes the admin filter correct without touching
     * it: `stripeOnboarded = true` now *entails* an account id.
     *
     * **Deliberately not a format check.** #387 asked whether this should also
     * require `acct_` plus Stripe's id charset, and it should not. Stripe does
     * not publish the charset as a contract, so a regex is a guess that would
     * refuse a legitimate future id and break onboarding in production — the
     * failure this exists to prevent, inverted. It would also reject ids this
     * repository writes on purpose: `seed-demo` gives its thirteen offline
     * vendors `acct_demo_<key>` (`acct_demo_silver_alder`) precisely so they
     * cannot be mistaken for real accounts.
     *
     * **What that leaves open, on purpose.** A fabricated but non-null id —
     * #387's `acct_e2e_fixture_not_a_real_account` — passes this constraint and
     * `openCheckout`'s guard, reaches Stripe as `transfer_data[destination]`,
     * and comes back 400. This constraint does not address that and a regex
     * would not either, since the remedy is to stop writing fixture ids at all.
     * What is made unrepresentable here is the *unaccompanied* flag: a writer
     * asserting onboarding it had not done.
     */
    check(
      'vendor_profiles_stripe_onboarded_requires_account',
      sql`${table.stripeOnboarded} = false OR ${table.stripeAccountId} IS NOT NULL`,
    ),
  ],
);

export type VendorProfileRow = typeof vendorProfiles.$inferSelect;
export type NewVendorProfileRow = typeof vendorProfiles.$inferInsert;
