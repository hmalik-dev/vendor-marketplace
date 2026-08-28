/**
 * The cast of demo vendors that populates marketing screenshots.
 *
 * This file is data, not logic: `seed-marketing.ts` is the only thing that
 * reads it. It is the single source of truth for who exists, what they charge
 * and how they are rated, so a screenshot taken today can be reproduced from a
 * clean database tomorrow.
 *
 * **Every vendor here is fictional.** The names, cities and copy are invented,
 * and the cover images are licensed stock standing in for a real vendor's own
 * photography. Nothing in this file describes a real business.
 *
 * `rating` and `reviewCount` are *targets*, not values written to the vendor
 * row. The seed generates that many real reviews, each behind a real completed
 * booking, and then recomputes `vendor_profiles.avg_rating` from those rows —
 * the same direction of travel the application enforces. A profile that claims
 * 127 reviews therefore has 127 reviews to show.
 */

/** Cover art lives in `apps/web/public/marketing/vendors`, keyed by slug. */
export const MARKETING_COVER_BASE = '/marketing/vendors';

export interface MarketingPackageSeed {
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly inclusions: readonly string[];
}

export interface MarketingVendorSeed {
  readonly slug: string;
  readonly businessName: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly city: string;
  readonly state: string;
  readonly bio: string;
  /**
   * The vendor's own line, opening the About tab as a pull-quote.
   *
   * Optional on purpose: two vendors are seeded without one, because a profile
   * with no pull-quote is a state the page has to render correctly and an
   * empty state nothing reaches is an empty state nobody has checked.
   */
  readonly tagline?: string;
  /** Self-declared. Omitted for two vendors, and `0` for one just starting. */
  readonly yearsInBusiness?: number;
  readonly responseTimeHours: number;
  /**
   * The average the generated reviews must reproduce, to two decimal places.
   * `0` means a genuinely unreviewed vendor — Sunlit Studio is deliberately
   * one, because every empty state in the product needs a row that reaches it.
   */
  readonly rating: number;
  readonly reviewCount: number;
  /**
   * Ordered cheapest first. The first entry is what a card's "From" price
   * shows, because search derives that from the lowest active package.
   */
  readonly packages: readonly MarketingPackageSeed[];
}

/** Three tiers, priced off the entry package so the ladder reads sensibly. */
function photographyPackages(fromCents: number): readonly MarketingPackageSeed[] {
  return [
    {
      name: 'Half-day coverage',
      description: 'Four hours on the day, for a ceremony and portraits without the full timeline.',
      priceCents: fromCents,
      inclusions: ['4 hours coverage', '150 edited images', 'Online gallery'],
    },
    {
      name: 'Full-day coverage',
      description:
        'Getting ready through to the last dance, with a second shooter for the ceremony.',
      priceCents: Math.round((fromCents * 1.8) / 5000) * 5000,
      inclusions: ['8 hours coverage', 'Second shooter', '450 edited images', 'Online gallery'],
    },
    {
      name: 'Full day and album',
      description: 'Full-day coverage plus a hand-bound album chosen from your gallery.',
      priceCents: Math.round((fromCents * 2.7) / 5000) * 5000,
      inclusions: [
        '10 hours coverage',
        'Second shooter',
        '600 edited images',
        '30-page album',
        'Engagement session',
      ],
    },
  ];
}

/**
 * Sixteen photographers around Austin. The first six are the cast the design
 * frames draw; the rest were already in the development database and are kept
 * so search results stay full enough to screenshot.
 */
export const MARKETING_VENDORS: readonly MarketingVendorSeed[] = [
  {
    slug: 'june-harlow',
    businessName: 'June Harlow',
    firstName: 'June',
    lastName: 'Harlow',
    city: 'Austin',
    state: 'TX',
    bio: 'Documentary coverage of the day as it actually happens. I shoot quietly, mostly on film, and I will not ask you to do anything twice.',
    tagline: 'Quiet, documentary, never asks you to pose.',
    yearsInBusiness: 10,
    responseTimeHours: 2,
    rating: 4.9,
    reviewCount: 127,
    packages: photographyPackages(145_000),
  },
  {
    slug: 'cardenas-studio',
    businessName: 'Cardenas Studio',
    firstName: 'Mateo',
    lastName: 'Cardenas',
    city: 'Austin',
    state: 'TX',
    bio: 'A two-person studio working receptions after dark. We bring our own light and we know how to use it.',
    tagline: 'Warm, unhurried portraits with a lot of laughing.',
    yearsInBusiness: 8,
    responseTimeHours: 4,
    rating: 4.8,
    reviewCount: 64,
    packages: photographyPackages(120_000),
  },
  {
    slug: 'wren-field',
    businessName: 'Wren & Field',
    firstName: 'Etta',
    lastName: 'Wren',
    city: 'Round Rock',
    state: 'TX',
    bio: 'Outdoor ceremonies, gardens and long golden hours. Newer to Austin, booking a small number of weddings a year.',
    tagline: 'Flowers that look like they were just picked.',
    yearsInBusiness: 6,
    responseTimeHours: 3,
    rating: 5,
    reviewCount: 18,
    packages: photographyPackages(98_000),
  },
  {
    slug: 'bright-room-co',
    businessName: 'Bright Room Co.',
    firstName: 'Nadia',
    lastName: 'Okonjo',
    city: 'Austin',
    state: 'TX',
    bio: 'Natural light only. Bright, airy, unfussy pictures of people who look like themselves.',
    tagline: 'Clean light, honest colour, nothing overworked.',
    yearsInBusiness: 4,
    responseTimeHours: 6,
    rating: 4.7,
    reviewCount: 92,
    packages: photographyPackages(168_000),
  },
  {
    slug: 'marlowe-sons',
    businessName: 'Marlowe & Sons',
    firstName: 'Ray',
    lastName: 'Marlowe',
    city: 'Buda',
    state: 'TX',
    bio: 'Second-generation wedding photographers. Classic, formal coverage and the family groups nobody else remembers to take.',
    tagline: 'Proper food, cooked on site, served hot.',
    yearsInBusiness: 15,
    responseTimeHours: 5,
    rating: 4.9,
    reviewCount: 41,
    packages: photographyPackages(132_000),
  },
  {
    slug: 'pomona-films',
    businessName: 'Pomona Films',
    firstName: 'Iris',
    lastName: 'Pomona',
    city: 'Austin',
    state: 'TX',
    bio: 'Cinematic stills and a short film of the day, shot as one job by one team so the two never fight over the same moment.',
    tagline: 'Films that play like a memory, not a highlight reel.',
    yearsInBusiness: 7,
    responseTimeHours: 8,
    rating: 4.8,
    reviewCount: 55,
    packages: photographyPackages(210_000),
  },
  {
    slug: 'atlas-thorn',
    businessName: 'Atlas & Thorn',
    firstName: 'Sam',
    lastName: 'Atlas',
    city: 'Buda',
    state: 'TX',
    bio: 'Golden-hour portraits and elopements, mostly out in the hill country.',
    tagline: 'Sculptural arrangements for rooms with high ceilings.',
    yearsInBusiness: 5,
    responseTimeHours: 12,
    rating: 4.6,
    reviewCount: 43,
    packages: photographyPackages(110_000),
  },
  {
    slug: 'cedar-sparrow',
    businessName: 'Cedar & Sparrow',
    firstName: 'Wren',
    lastName: 'Cedar',
    city: 'Austin',
    state: 'TX',
    bio: 'Garden weddings and greenery. Happiest outdoors with a long lens and no schedule.',
    tagline: 'Small weddings, long tables, very good bread.',
    yearsInBusiness: 3,
    responseTimeHours: 10,
    rating: 4.5,
    reviewCount: 70,
    packages: photographyPackages(94_000),
  },
  {
    slug: 'delaney-rowe',
    businessName: 'Delaney Rowe',
    firstName: 'Delaney',
    lastName: 'Rowe',
    city: 'Round Rock',
    state: 'TX',
    bio: 'Portrait-led coverage. I spend the day looking for faces rather than details.',
    tagline: 'I keep the dance floor full and the volume sensible.',
    yearsInBusiness: 12,
    responseTimeHours: 4,
    rating: 4.8,
    reviewCount: 94,
    packages: photographyPackages(138_000),
  },
  {
    slug: 'hollow-creek',
    businessName: 'Hollow Creek',
    firstName: 'Tess',
    lastName: 'Hollow',
    city: 'Austin',
    state: 'TX',
    bio: 'Relaxed, unposed pictures for couples who would rather be at their own party.',
    tagline: 'A barn, a field, and room for two hundred.',
    yearsInBusiness: 20,
    responseTimeHours: 7,
    rating: 4.8,
    reviewCount: 35,
    packages: photographyPackages(102_000),
  },
  {
    slug: 'kessler-co',
    businessName: 'Kessler & Co.',
    firstName: 'Maya',
    lastName: 'Kessler',
    city: 'Austin',
    state: 'TX',
    bio: 'Full-service studio covering receptions, rehearsal dinners and the morning after.',
    tagline: 'Editorial polish without the editorial fuss.',
    yearsInBusiness: 9,
    responseTimeHours: 2,
    rating: 4.9,
    reviewCount: 127,
    packages: photographyPackages(175_000),
  },
  {
    slug: 'marigold-co',
    businessName: 'Marigold & Co.',
    firstName: 'Priya',
    lastName: 'Nandakumar',
    city: 'Austin',
    state: 'TX',
    bio: 'Colour-forward coverage of South Asian and multi-day weddings. Four languages between the two of us.',
    tagline: 'Cakes that taste as good as they photograph.',
    yearsInBusiness: 6,
    responseTimeHours: 3,
    rating: 4.8,
    reviewCount: 51,
    packages: photographyPackages(158_000),
  },
  {
    slug: 'northgate-frame',
    businessName: 'Northgate Frame',
    firstName: 'Owen',
    lastName: 'Frame',
    city: 'Austin',
    state: 'TX',
    bio: 'City-hall ceremonies, rooftops and downtown portraits. Small weddings a speciality.',
    tagline: 'Straightforward coverage, delivered in a fortnight.',
    yearsInBusiness: 2,
    responseTimeHours: 9,
    rating: 4.7,
    reviewCount: 23,
    packages: photographyPackages(86_000),
  },
  {
    slug: 'salt-vine-studio',
    businessName: 'Salt & Vine Studio',
    firstName: 'Lena',
    lastName: 'Salt',
    city: 'Austin',
    state: 'TX',
    bio: 'Long-table dinners, vineyards and receptions that run late. We shoot food as carefully as we shoot people.',
    tagline: 'Seasonal menus built around what is actually good.',
    yearsInBusiness: 11,
    responseTimeHours: 5,
    rating: 4.9,
    reviewCount: 61,
    packages: photographyPackages(164_000),
  },
  {
    slug: 'sunlit-studio',
    businessName: 'Sunlit Studio',
    firstName: 'Cody',
    lastName: 'Reyes',
    city: 'Oakland',
    state: 'CA',
    bio: 'Just opened for bookings. No reviews yet — the first couple to book gets my full attention and a lower rate for it.',
    yearsInBusiness: 0,
    responseTimeHours: 1,
    // Deliberately unreviewed: the "no reviews yet" state needs a real row to
    // render against, and an out-of-market city keeps the Austin search honest.
    rating: 0,
    reviewCount: 0,
    packages: photographyPackages(78_000),
  },
  {
    slug: 'wildhaven-film',
    businessName: 'Wildhaven Film',
    firstName: 'Jonah',
    lastName: 'Wilde',
    city: 'Austin',
    state: 'TX',
    bio: 'Woodland and state-park ceremonies. I will hike to the spot with you.',
    responseTimeHours: 6,
    rating: 5,
    reviewCount: 17,
    packages: photographyPackages(126_000),
  },
];

/**
 * Reviewers. A fixed pool reused across vendors, because a marketplace where
 * every review comes from a first-time customer is not a marketplace.
 */
export const MARKETING_CUSTOMERS: readonly { first: string; last: string }[] = [
  { first: 'Ana', last: 'Lucero' },
  { first: 'Tom', last: 'Ridley' },
  { first: 'Priya', last: 'Raman' },
  { first: 'Jordan', last: 'Webb' },
  { first: 'Nina', last: 'Alvarez' },
  { first: 'Marcus', last: 'Bell' },
  { first: 'Sofia', last: 'Marchetti' },
  { first: 'Dev', last: 'Patel' },
  { first: 'Hannah', last: 'Cole' },
  { first: 'Luis', last: 'Ferrer' },
  { first: 'Grace', last: 'Okafor' },
  { first: 'Ethan', last: 'Brooks' },
  { first: 'Mei', last: 'Lin' },
  { first: 'Caleb', last: 'Nguyen' },
  { first: 'Ruth', last: 'Adeyemi' },
  { first: 'Oscar', last: 'Delgado' },
  { first: 'Freya', last: 'Lindqvist' },
  { first: 'Amir', last: 'Haddad' },
  { first: 'Chloe', last: 'Barnes' },
  { first: 'Reuben', last: 'Katz' },
  { first: 'Isla', last: 'Moreau' },
  { first: 'Tariq', last: 'Rahman' },
  { first: 'Elena', last: 'Vasquez' },
  { first: 'Beau', last: 'Sinclair' },
];

/**
 * Review copy, banded by rating so a three-star row does not read like praise.
 * Picked deterministically, so the same seed run always produces the same text.
 */
export const REVIEW_COPY: Readonly<Record<number, readonly string[]>> = {
  5: [
    'Genuinely the easiest vendor we booked. Turned up early, found the light, and we barely noticed them all day.',
    'The gallery came back in under two weeks and we have already ordered prints. Every group shot we asked for is there.',
    'Calm, funny, and completely unflappable when the rain moved the ceremony indoors. Worth every cent.',
    'We got pictures of people we did not even know were there. It feels like the whole day rather than a highlights reel.',
    'Answered every email within the day, sent a timeline we actually used, and delivered exactly what was promised.',
  ],
  4: [
    'Lovely work and we are happy with the gallery. The turnaround was a little longer than we expected.',
    'Great on the day and very easy to work with. A few of the reception shots came back darker than the rest.',
    'Really pleased overall. We would have liked a couple more family groups, but that is partly on our timeline.',
    'Professional and unobtrusive. The edit is slightly warmer than the samples we picked from, which took adjusting to.',
  ],
  3: [
    'The ceremony coverage is good. Communication in the run-up was slower than we would have liked.',
    'Fine work, and the portraits are lovely, but the gallery took longer to arrive than we were quoted.',
    'Some really nice frames in there. We did have to chase for the album proofs more than once.',
  ],
  2: [
    'The pictures are usable but we had to ask twice for the full gallery, and a few requested shots are missing.',
  ],
  1: ['Not what we were expecting from the portfolio, and the gallery was late.'],
};
