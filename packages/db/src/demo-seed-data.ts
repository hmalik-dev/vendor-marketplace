import { EVENT_TYPES } from '@vendor-marketplace/shared';
import type { CATEGORY_SLUGS, EventType, PriceType } from '@vendor-marketplace/shared';

/**
 * The cast for the demo marketplace — `pnpm db:seed:demo`.
 *
 * Distinct from `marketing-seed-data.ts` on purpose. That set is sixteen
 * photographers, sized to fill one category's search grid for a screenshot.
 * This one is deliberately thin per category and wide across them: at least
 * one published vendor in every one of the eleven `CATEGORY_SEEDS`, so a
 * category browse, a filter combination or an empty-state check never lands on
 * a category nobody trades in. The two seeds own disjoint rows and can be run
 * together.
 */

/** Every identity this seed creates carries this prefix in `clerk_user_id`. */
export const DEMO_SEED_PREFIX = 'seed_demo_';

/** Namespace prefix for every `deterministicUuid` this seed derives. */
export const DEMO_UUID_NAMESPACE = 'orla.demo';

/**
 * The only imagery the demo seed may reference, by category slug.
 *
 * **A seeded URL that 404s is worse than no URL at all.** `VendorCard` and
 * `Avatar` render a designed placeholder when the image is `null`, but a
 * non-null value becomes a raw `<img>` with no error handling — so a path to a
 * file that does not exist shows a broken-image glyph on every card, which is
 * the opposite of what a demo dataset is for.
 *
 * These six files already ship under `apps/web/public/categories/`. No new
 * asset is added and none is borrowed from `apps/web/public/stock/`, whose
 * `CREDITS.md` records that most of that imagery has unverified provenance and
 * calls it a launch blocker; a seed is no reason to widen that exposure.
 *
 * The five categories absent here have no licensed image, so their vendors get
 * a null cover and no portfolio, and render the designed placeholder instead.
 * That is a deliberate half of the dataset: `design-plan/40-states.md`
 * distinguishes the illustrated card from the placeholder one, and a demo where
 * every vendor has a photograph exercises only one of them.
 */
export const DEMO_CATEGORY_IMAGES: Readonly<Record<string, string>> = {
  photography: '/categories/photography.jpg',
  entertainment: '/categories/entertainment.jpg',
  catering: '/categories/catering.jpg',
  venues: '/categories/venues.jpg',
  florals: '/categories/florals.jpg',
  beauty: '/categories/beauty.jpg',
};

/** The image a demo vendor shows, or `null` where its category has none. */
export function demoImageFor(categorySlug: string): string | null {
  return DEMO_CATEGORY_IMAGES[categorySlug] ?? null;
}

export interface DemoPackageSeed {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly priceType: PriceType;
  readonly durationHours: string | null;
  readonly maxGuests: number | null;
  readonly inclusions: readonly string[];
}

export interface DemoVendorSeed {
  readonly key: string;
  readonly categorySlug: (typeof CATEGORY_SLUGS)[number];
  readonly businessName: string;
  readonly slug: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly tagline: string;
  readonly bio: string;
  readonly city: string;
  readonly state: string;
  readonly yearsInBusiness: number;
  readonly responseTimeHours: number;
  readonly portfolioCount: number;
  readonly packages: readonly DemoPackageSeed[];
}

export interface DemoCustomerSeed {
  readonly key: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly city: string;
  readonly state: string;
  readonly bio: string | null;
  /**
   * Share of the booking graph this customer receives. A zero share is the
   * point of the "new member" profile: the empty states in
   * `design-plan/40-states.md` need an account that has genuinely never
   * booked, and one that merely looks empty because the seed ran short is a
   * different thing.
   */
  readonly bookingShare: number;
}

export const DEMO_ADMIN = {
  key: 'admin',
  firstName: 'Ops',
  lastName: 'Administrator',
  city: 'Austin',
  state: 'TX',
} as const;

export const DEMO_CUSTOMERS: readonly DemoCustomerSeed[] = [
  {
    key: 'new-member',
    firstName: 'Nora',
    lastName: 'Whitfield',
    city: 'Austin',
    state: 'TX',
    bio: null,
    bookingShare: 0,
  },
  {
    key: 'active-booker',
    firstName: 'Desmond',
    lastName: 'Park',
    city: 'Chicago',
    state: 'IL',
    bio: 'Planning a long engagement party season and two family milestones this year.',
    bookingShare: 2,
  },
  {
    key: 'power-user',
    firstName: 'Priyanka',
    lastName: 'Shah',
    city: 'New York',
    state: 'NY',
    bio: 'Corporate events lead. I book a lot, I review everything, and I keep good notes.',
    bookingShare: 3,
  },
];

function pkg(
  key: string,
  name: string,
  description: string,
  priceCents: number,
  options: {
    priceType?: PriceType;
    durationHours?: string | null;
    maxGuests?: number | null;
    inclusions: readonly string[];
  },
): DemoPackageSeed {
  return {
    key,
    name,
    description,
    priceCents,
    priceType: options.priceType ?? 'fixed',
    durationHours: options.durationHours ?? null,
    maxGuests: options.maxGuests ?? null,
    inclusions: options.inclusions,
  };
}

/**
 * Thirteen vendors covering all eleven categories, with `photography` and
 * `catering` carrying two so the two busiest grids are not single-row. Prices
 * span the $500–$15,000 band the ticket asks for, and no two vendors share a
 * city-and-category pair, so a city filter always narrows rather than empties.
 */
export const DEMO_VENDORS: readonly DemoVendorSeed[] = [
  {
    key: 'rosewater-photography',
    categorySlug: 'photography',
    businessName: 'Rosewater Photography',
    slug: 'rosewater-photography',
    firstName: 'Imogen',
    lastName: 'Rossi',
    tagline: 'Documentary coverage, warm and unhurried',
    bio: 'We shoot the day as it happens — no shot lists, no staged lineups. Two photographers on every booking, and a gallery that lands within three weeks.',
    city: 'Austin',
    state: 'TX',
    yearsInBusiness: 9,
    responseTimeHours: 4,
    portfolioCount: 6,
    packages: [
      pkg(
        'half-day',
        'Half Day',
        'Five hours of continuous coverage with a second shooter.',
        185000,
        {
          durationHours: '5.0',
          inclusions: ['Second photographer', '250 edited images', 'Online gallery for 12 months'],
        },
      ),
      pkg('full-day', 'Full Day', 'Ten hours from getting ready through the last dance.', 320000, {
        durationHours: '10.0',
        inclusions: [
          'Second photographer',
          '600 edited images',
          'Engagement session',
          'Print release',
        ],
      }),
      pkg('elopement', 'Elopement', 'Two hours for a small ceremony and portraits.', 78000, {
        durationHours: '2.0',
        maxGuests: 20,
        inclusions: ['120 edited images', 'Online gallery for 12 months'],
      }),
    ],
  },
  {
    key: 'silver-alder',
    categorySlug: 'photography',
    businessName: 'Silver Alder Studio',
    slug: 'silver-alder-studio',
    firstName: 'Tomas',
    lastName: 'Bergland',
    tagline: 'Editorial portraiture on medium format film',
    bio: 'A film-first studio. Every booking is shot on medium format and hand-scanned, with a digital second body for reception light.',
    city: 'Chicago',
    state: 'IL',
    yearsInBusiness: 6,
    responseTimeHours: 12,
    portfolioCount: 5,
    packages: [
      pkg('portrait', 'Portrait Session', 'Ninety minutes on location, film and digital.', 95000, {
        durationHours: '1.5',
        inclusions: ['40 edited scans', 'Location scouting', 'Print release'],
      }),
      pkg('event', 'Event Coverage', 'Six hours of editorial event coverage.', 245000, {
        durationHours: '6.0',
        inclusions: ['400 edited images', 'Film and digital', 'Second shooter'],
      }),
    ],
  },
  {
    key: 'nightjar-sound',
    categorySlug: 'entertainment',
    businessName: 'Nightjar Sound',
    slug: 'nightjar-sound',
    firstName: 'Ayo',
    lastName: 'Balogun',
    tagline: 'Open-format DJ sets and live percussion',
    bio: 'Fifteen years behind the decks across five boroughs. Open-format sets built from your list, with optional live percussion for the last hour.',
    city: 'New York',
    state: 'NY',
    yearsInBusiness: 15,
    responseTimeHours: 2,
    portfolioCount: 4,
    packages: [
      pkg('reception', 'Reception Set', 'Four hours of open-format DJ coverage.', 210000, {
        durationHours: '4.0',
        inclusions: ['Full PA system', 'Wireless microphones', 'Dance floor lighting'],
      }),
      pkg(
        'ceremony-reception',
        'Ceremony & Reception',
        'Ceremony sound plus six reception hours.',
        340000,
        {
          durationHours: '6.0',
          inclusions: ['Ceremony PA', 'Cocktail-hour set', 'Live percussion', 'MC service'],
        },
      ),
      pkg('hourly-add', 'Additional Hour', 'Extends any booked set.', 45000, {
        priceType: 'hourly',
        durationHours: '1.0',
        inclusions: ['Continuous coverage'],
      }),
    ],
  },
  {
    key: 'copper-spoon',
    categorySlug: 'catering',
    businessName: 'Copper Spoon Catering',
    slug: 'copper-spoon-catering',
    firstName: 'Marisol',
    lastName: 'Vega',
    tagline: 'Seasonal California menus, family style',
    bio: 'Menus built around what the Santa Monica market has that week. Family-style service by default; plated on request.',
    city: 'Los Angeles',
    state: 'CA',
    yearsInBusiness: 11,
    responseTimeHours: 8,
    portfolioCount: 6,
    packages: [
      pkg('family-style', 'Family Style Dinner', 'Three shared courses, staffed.', 14500, {
        priceType: 'starting_at',
        maxGuests: 200,
        inclusions: ['Three courses', 'Front-of-house staff', 'Rentals coordination'],
      }),
      pkg('cocktail', 'Cocktail Reception', 'Six passed canapés and two stations.', 9800, {
        priceType: 'starting_at',
        maxGuests: 250,
        inclusions: ['Six passed items', 'Two stations', 'Bar staff'],
      }),
      pkg('tasting', 'Private Tasting', 'A full menu tasting for up to four.', 65000, {
        durationHours: '2.0',
        maxGuests: 4,
        inclusions: ['Full menu tasting', 'Wine pairing', 'Menu consultation'],
      }),
    ],
  },
  {
    key: 'vela-and-fig',
    categorySlug: 'catering',
    businessName: 'Vela & Fig',
    slug: 'vela-and-fig',
    firstName: 'Camila',
    lastName: 'Duarte',
    tagline: 'Caribbean and Latin menus for large rooms',
    bio: 'Large-format Caribbean and Latin cooking for events from eighty to eight hundred, with a kitchen that has run both.',
    city: 'Miami',
    state: 'FL',
    yearsInBusiness: 13,
    responseTimeHours: 6,
    portfolioCount: 5,
    packages: [
      pkg('buffet', 'Buffet Service', 'Two proteins, four sides, staffed buffet.', 8900, {
        priceType: 'starting_at',
        maxGuests: 800,
        inclusions: ['Two proteins', 'Four sides', 'Buffet staff', 'Chafing equipment'],
      }),
      pkg('plated', 'Plated Dinner', 'Three plated courses with synchronized service.', 16500, {
        priceType: 'starting_at',
        maxGuests: 400,
        inclusions: ['Three plated courses', 'Synchronized service', 'Dedicated captain'],
      }),
    ],
  },
  {
    key: 'foundry-hall',
    categorySlug: 'venues',
    businessName: 'The Foundry Hall',
    slug: 'the-foundry-hall',
    firstName: 'Warren',
    lastName: 'Okonkwo',
    tagline: 'A restored ironworks with 40-foot ceilings',
    bio: 'Twelve thousand square feet of restored 1912 ironworks, with a courtyard for ceremonies and a mezzanine for cocktail hour.',
    city: 'Houston',
    state: 'TX',
    yearsInBusiness: 7,
    responseTimeHours: 24,
    portfolioCount: 6,
    packages: [
      pkg(
        'full-buyout',
        'Full Venue Buyout',
        'The hall, courtyard and mezzanine for one day.',
        1250000,
        {
          durationHours: '12.0',
          maxGuests: 400,
          inclusions: ['Exclusive use', 'Tables and chairs', 'On-site manager', 'Parking for 120'],
        },
      ),
      pkg('courtyard', 'Courtyard Ceremony', 'Courtyard only, three hours.', 380000, {
        durationHours: '3.0',
        maxGuests: 150,
        inclusions: ['Courtyard access', 'Ceremony seating', 'Weather contingency'],
      }),
      pkg('mezzanine', 'Mezzanine Reception', 'Mezzanine only, for smaller receptions.', 520000, {
        durationHours: '5.0',
        maxGuests: 90,
        inclusions: ['Mezzanine access', 'Bar setup', 'On-site manager'],
      }),
    ],
  },
  {
    key: 'thistle-and-fern',
    categorySlug: 'florals',
    businessName: 'Thistle & Fern',
    slug: 'thistle-and-fern',
    firstName: 'Saoirse',
    lastName: 'Kelleher',
    tagline: 'Foraged, seasonal, never wired',
    bio: 'Loose, garden-style arrangements from Hudson Valley growers. We do not use dyed or imported stems.',
    city: 'New York',
    state: 'NY',
    yearsInBusiness: 8,
    responseTimeHours: 10,
    portfolioCount: 6,
    packages: [
      pkg('ceremony', 'Ceremony Florals', 'Arch, aisle and altar arrangements.', 275000, {
        inclusions: ['Ceremony arch', 'Aisle meadows', 'Altar arrangements', 'Installation'],
      }),
      pkg('personal', 'Personal Flowers', 'Bouquets, boutonnieres and corsages.', 98000, {
        inclusions: ['Bridal bouquet', 'Six bouquets', 'Ten boutonnieres', 'Delivery'],
      }),
      pkg('reception', 'Reception Tables', 'Centrepieces and bar arrangements.', 185000, {
        inclusions: ['Twenty centrepieces', 'Bar arrangements', 'Installation', 'Same-day strike'],
      }),
    ],
  },
  {
    key: 'lumen-beauty',
    categorySlug: 'beauty',
    businessName: 'Lumen Beauty Collective',
    slug: 'lumen-beauty-collective',
    firstName: 'Zainab',
    lastName: 'Osei',
    tagline: 'Hair and makeup for every skin tone',
    bio: 'A six-artist collective. We carry a full range of foundation shades and texture-specific hair products to every booking.',
    city: 'Los Angeles',
    state: 'CA',
    yearsInBusiness: 5,
    responseTimeHours: 3,
    portfolioCount: 5,
    packages: [
      pkg('bridal-party', 'Bridal Party', 'Hair and makeup for up to six.', 145000, {
        durationHours: '5.0',
        maxGuests: 6,
        inclusions: ['Two artists', 'Trial session', 'Touch-up kit', 'On-location'],
      }),
      pkg('single', 'Single Application', 'One hair and makeup application.', 42000, {
        durationHours: '1.5',
        maxGuests: 1,
        inclusions: ['Hair styling', 'Makeup application', 'Lashes'],
      }),
      pkg('all-day', 'All-Day Attendance', 'An artist stays through the reception.', 96000, {
        priceType: 'hourly',
        durationHours: '8.0',
        inclusions: ['Dedicated artist', 'Unlimited touch-ups', 'Second-look change'],
      }),
    ],
  },
  {
    key: 'little-bell',
    categorySlug: 'carts',
    businessName: 'Little Bell Coffee Cart',
    slug: 'little-bell-coffee-cart',
    firstName: 'Hana',
    lastName: 'Kimura',
    tagline: 'A three-group espresso bar on wheels',
    bio: 'A restored 1974 Piaggio with a three-group La Marzocco. Two baristas, and we pull about 120 drinks an hour.',
    city: 'Austin',
    state: 'TX',
    yearsInBusiness: 4,
    responseTimeHours: 5,
    portfolioCount: 4,
    packages: [
      pkg('three-hour', 'Three-Hour Service', 'Espresso bar with two baristas.', 135000, {
        durationHours: '3.0',
        maxGuests: 250,
        inclusions: [
          'Two baristas',
          'Full espresso menu',
          'Oat and dairy milk',
          'Compostable cups',
        ],
      }),
      pkg('welcome', 'Welcome Hour', 'One hour of arrival coffee.', 58000, {
        durationHours: '1.0',
        maxGuests: 120,
        inclusions: ['One barista', 'Drip and espresso', 'Compostable cups'],
      }),
    ],
  },
  {
    key: 'hollow-and-pine',
    categorySlug: 'decor',
    businessName: 'Hollow & Pine Decor',
    slug: 'hollow-and-pine-decor',
    firstName: 'Elias',
    lastName: 'Nowak',
    tagline: 'Built sets, not rented backdrops',
    bio: 'We build to the room. Every install is fabricated in our Pilsen shop and struck the same night.',
    city: 'Chicago',
    state: 'IL',
    yearsInBusiness: 10,
    responseTimeHours: 18,
    portfolioCount: 6,
    packages: [
      pkg('full-install', 'Full Install', 'Design, fabrication, install and strike.', 680000, {
        inclusions: ['Concept drawings', 'Custom fabrication', 'Install crew', 'Same-night strike'],
      }),
      pkg('focal', 'Focal Installation', 'One statement piece — backdrop or ceiling.', 245000, {
        inclusions: ['Concept drawings', 'Fabrication', 'Install and strike'],
      }),
      pkg('consult', 'Design Consultation', 'Two hours of on-site design consultation.', 55000, {
        durationHours: '2.0',
        inclusions: ['Site walk', 'Concept sketches', 'Budget outline'],
      }),
    ],
  },
  {
    key: 'blue-hour-films',
    categorySlug: 'videography',
    businessName: 'Blue Hour Films',
    slug: 'blue-hour-films',
    firstName: 'Ravi',
    lastName: 'Menon',
    tagline: 'Documentary films, no staged reshoots',
    bio: 'Two-operator documentary coverage cut to a seven-minute film. Audio is recorded on three sources, because that is what ruins most wedding films.',
    city: 'Miami',
    state: 'FL',
    yearsInBusiness: 7,
    responseTimeHours: 9,
    portfolioCount: 5,
    packages: [
      pkg('feature', 'Feature Film', 'Full-day coverage cut to a seven-minute film.', 425000, {
        durationHours: '10.0',
        inclusions: ['Two operators', 'Seven-minute film', 'Three audio sources', 'Raw footage'],
      }),
      pkg('highlight', 'Highlight Reel', 'Six hours cut to a three-minute reel.', 265000, {
        durationHours: '6.0',
        inclusions: ['Two operators', 'Three-minute reel', 'Licensed music'],
      }),
      pkg('ceremony-only', 'Ceremony Only', 'Single-camera ceremony record.', 118000, {
        durationHours: '2.0',
        inclusions: ['Full ceremony edit', 'Two audio sources'],
      }),
    ],
  },
  {
    key: 'ember-lane',
    categorySlug: 'planning',
    businessName: 'Ember Lane Planning',
    slug: 'ember-lane-planning',
    firstName: 'Odette',
    lastName: 'Laurent',
    tagline: 'Full planning for events over 150',
    bio: 'Twelve years of large-format planning. We take four full-planning clients a year and run month-of for six more.',
    city: 'Houston',
    state: 'TX',
    yearsInBusiness: 12,
    responseTimeHours: 6,
    portfolioCount: 4,
    packages: [
      pkg('full', 'Full Planning', 'Twelve months of end-to-end planning.', 1450000, {
        inclusions: [
          'Vendor sourcing',
          'Budget management',
          'Design direction',
          'Day-of team of four',
        ],
      }),
      pkg('month-of', 'Month-Of Coordination', 'Six weeks out through the event.', 480000, {
        inclusions: ['Vendor confirmations', 'Timeline build', 'Day-of team of two', 'Rehearsal'],
      }),
      pkg('hourly', 'Hourly Consulting', 'Planning advice by the hour.', 32000, {
        priceType: 'hourly',
        durationHours: '1.0',
        inclusions: ['Video consultation', 'Written follow-up'],
      }),
    ],
  },
  {
    key: 'stonecrop-rentals',
    categorySlug: 'rentals',
    businessName: 'Stonecrop Rentals',
    slug: 'stonecrop-rentals',
    firstName: 'Bea',
    lastName: 'Cantrell',
    tagline: 'Tables, linen and glassware across Central Texas',
    bio: 'A rental inventory built for outdoor events — weighted tenting, real glassware and linen that survives a Hill Country afternoon.',
    city: 'Austin',
    state: 'TX',
    yearsInBusiness: 16,
    responseTimeHours: 14,
    portfolioCount: 4,
    packages: [
      pkg(
        'full-service',
        'Full Service Rental',
        'Tables, seating, linen, glass and delivery.',
        385000,
        {
          maxGuests: 300,
          inclusions: [
            'Tables and seating',
            'Linen',
            'Glassware and flatware',
            'Delivery and strike',
          ],
        },
      ),
      pkg(
        'tenting',
        'Tenting Package',
        'Weighted frame tent with sidewalls and lighting.',
        620000,
        {
          maxGuests: 250,
          inclusions: ['Frame tent', 'Sidewalls', 'String lighting', 'Install and strike'],
        },
      ),
      pkg('essentials', 'Essentials', 'Tables, chairs and delivery only.', 52000, {
        priceType: 'starting_at',
        maxGuests: 120,
        inclusions: ['Tables and chairs', 'Delivery and pickup'],
      }),
    ],
  },
];

/**
 * Occasions a demo request can be for.
 *
 * Taken from `EVENT_TYPES` rather than written out: the column holds the slug,
 * not the label — `eventTypeSchema` is `z.enum(EVENT_TYPES)` at the API edge —
 * and a hand-written list drifts. It already had, with `'Engagement party'`
 * against a vocabulary whose entry is `engagement`.
 */
export const DEMO_EVENT_TYPES: readonly EventType[] = EVENT_TYPES;

/**
 * Message copy, in send order. A thread alternates customer and vendor
 * starting with the customer, so the length decides who spoke last — which is
 * what the unread badge and the "awaiting your reply" filter key on.
 */
export const DEMO_MESSAGE_THREAD: readonly string[] = [
  'Hi — we are looking at this date and wanted to check you are still open. Could you send availability?',
  'We are open that weekend. Happy to hold it informally for a few days while you decide.',
  'That would be great, thank you. Roughly how many people can you cover comfortably?',
  'Comfortably up to the package maximum. Beyond that we would add a second team, which changes the quote.',
  'Understood. Could you put together a quote for the package plus one extra hour?',
  'Sent it through just now — the extra hour is itemised separately so you can drop it later if you want.',
  'Got it, thank you. Reviewing with my partner tonight and I will come back tomorrow.',
  'No rush at all. The hold stands until Friday, and I will flag it if anything changes.',
  'We are happy with it. Anything you need from us before we confirm?',
  'Just the venue contact and a rough timeline once you have one. Everything else I can handle.',
];

/** Review copy for the customer-facing direction, banded by rating. */
export const DEMO_CUSTOMER_REVIEW_COPY: Readonly<Record<number, readonly string[]>> = {
  5: [
    'Completely unflappable on the day, and the result was better than we pictured. Would book again without hesitating.',
    'Communication was quick from the first message to the final handover. Everything arrived when they said it would.',
    'They read the room perfectly and never needed managing. Several guests asked us who they were.',
  ],
  4: [
    'Really strong work and easy to deal with. Setup ran slightly behind, but they made the time back.',
    'Very happy overall. A couple of the small details differed from what we discussed, but nothing that mattered on the day.',
    'Professional and well prepared. Would recommend, with the caveat that you should confirm the timeline in writing.',
  ],
  3: [
    'The work itself was fine. Getting replies during planning took longer than we would have liked.',
    'Delivered what was agreed, though not much beyond it. Reasonable for the price.',
    'Mixed — the day went smoothly, but the handover afterwards dragged on for weeks.',
  ],
};

/** Review copy for the private vendor-to-customer direction. */
export const DEMO_VENDOR_REVIEW_COPY: Readonly<Record<number, readonly string[]>> = {
  5: [
    'Organised, decisive and generous with the timeline. An easy booking from start to finish.',
    'Answered quickly, paid on time, and gave the crew room to work. Would happily take another booking.',
  ],
  4: [
    'Good communication and a clear brief. A few late changes, but all reasonable ones.',
    'Straightforward to work with. The final headcount moved twice, which we absorbed.',
  ],
  3: [
    'Booking went ahead fine, though the details changed repeatedly in the last fortnight.',
    'Reachable but slow to confirm. The event itself ran without incident.',
  ],
};
