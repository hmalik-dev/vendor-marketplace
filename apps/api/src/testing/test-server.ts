import { seedReferenceData } from '@vendor-marketplace/db';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import type { FastifyInstance } from 'fastify';
import type { ApiEnv } from '../config/env.js';
import { publicUrlFor, type ObjectStorage } from '../lib/storage.js';
import type {
  StripeAccountStatus,
  StripeConnectGateway,
  StripeEventNotification,
} from '../lib/stripe.js';
import type { ClerkUserSnapshot } from '../modules/users/users.service.js';
import { buildServer } from '../server.js';
import type { Clock } from '../plugins/clock.js';

export const TEST_ENV: ApiEnv = {
  NODE_ENV: 'test',
  PORT: 4000,
  HOST: '127.0.0.1',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://test',
  CLERK_SECRET_KEY: 'sk_test_not_used',
  CLERK_WEBHOOK_SECRET: 'whsec_not_used',
  CLERK_WEBHOOK_ENDPOINT: 'http://localhost:4000/webhooks/clerk',
  WEB_URL: 'http://localhost:3000',
  /*
   * Deliberately not shaped like real Stripe credentials, and deliberately too
   * short to read as one. The suites inject a fake gateway, so no value here is
   * ever sent to Stripe or verified against a signature, and a realistic-looking
   * stand-in would only be a string the credential hook and the secret scanner
   * both have to be taught to ignore.
   */
  STRIPE_SECRET_KEY: 'unused',
  STRIPE_WEBHOOK_SECRET: 'unused',
  STRIPE_PLATFORM_FEE_RATE: '0.12',
  RATE_LIMIT_MAX: 1_000,
  S3_ENDPOINT: 'http://storage.test',
  S3_ACCESS_KEY_ID: 'test',
  S3_SECRET_ACCESS_KEY: 'test',
  S3_BUCKET: 'test-bucket',
  S3_PUBLIC_URL: 'http://cdn.test',
  S3_FORCE_PATH_STYLE: true,
};

export interface TestHarnessOptions {
  env?: Partial<ApiEnv>;
  loggerStream?: NodeJS.WritableStream;
  /**
   * Pins "now" for every date-sensitive route. A suite that leaves it unset
   * reads the real clock and is therefore hour-dependent; one that sets it
   * asserts the same thing at every hour and under every `TZ`.
   */
  clock?: Clock;
}

/** Records what a route stored instead of reaching S3. */
export interface RecordedObject {
  key: string;
  body: Buffer;
  contentType: string;
}

/**
 * The Stripe Connect boundary, recorded rather than called. Suites set the
 * capability statuses they want an account to have and read back what the
 * service asked Stripe to do.
 */
export interface FakeStripe extends StripeConnectGateway {
  /** Accounts the fake has minted, in creation order. */
  createdAccounts: { accountId: string; vendorId: string; contactEmail: string }[];
  /** Every onboarding link minted, so a suite can assert on the URLs sent. */
  createdLinks: { accountId: string; returnUrl: string; refreshUrl: string }[];
  /** Capability state per account id; absent means both capabilities inactive. */
  accountStatuses: Map<string, StripeAccountStatus>;
  /** Signatures the fake verifier accepts; anything else is rejected. */
  validSignatures: Set<string>;
  /** The notification the next verified webhook is parsed into. */
  nextEvent: StripeEventNotification;
}

function createFakeStripe(): FakeStripe {
  const createdAccounts: FakeStripe['createdAccounts'] = [];
  const createdLinks: FakeStripe['createdLinks'] = [];
  const accountStatuses = new Map<string, StripeAccountStatus>();
  const validSignatures = new Set<string>(['valid-signature']);

  const fake: FakeStripe = {
    createdAccounts,
    createdLinks,
    accountStatuses,
    validSignatures,
    nextEvent: { type: 'v2.core.account.updated', accountId: null },

    createRecipientAccount: async (input) => {
      const accountId = `acct_test_${createdAccounts.length + 1}`;
      createdAccounts.push({
        accountId,
        vendorId: input.vendorId,
        contactEmail: input.contactEmail,
      });
      return { accountId };
    },

    createOnboardingLink: async (input) => {
      createdLinks.push(input);
      return { url: `https://connect.stripe.test/setup/${input.accountId}/${createdLinks.length}` };
    },

    readAccountStatus: async (accountId) =>
      accountStatuses.get(accountId) ?? { transfersActive: false, payoutsActive: false },

    parseEventNotification: (_payload, signature) => {
      if (!validSignatures.has(signature)) {
        throw new Error('Invalid test Stripe signature');
      }
      return fake.nextEvent;
    },
  };

  return fake;
}

export interface TestHarness {
  app: FastifyInstance;
  database: TestDatabase;
  /** Objects written through `app.storage`, in the order they were stored. */
  storedObjects: RecordedObject[];
  /** Clerk identities the fake token verifier and lazy-sync loader resolve. */
  clerkUsers: Map<string, ClerkUserSnapshot>;
  /** Signatures the fake svix verifier accepts; anything else is rejected. */
  validWebhookSignatures: Set<string>;
  /** The Stripe Connect boundary, recorded rather than called. */
  stripe: FakeStripe;
  /** Simulates the storage bucket going away, for the readiness probe. */
  setStorageAvailable: (available: boolean) => void;
  close: () => Promise<void>;
}

/**
 * Boots the real server against an in-process Postgres, with the three network
 * boundaries (Clerk token verification, svix signature verification, and Stripe
 * Connect) replaced by explicit fakes. Everything between the HTTP edge and SQL
 * is the production code path.
 */
export async function createTestHarness(options: TestHarnessOptions = {}): Promise<TestHarness> {
  const database = await createTestDatabase();
  await database.runMigrations();
  // Categories and tags are reference data every deployment starts with, so
  // the suites see the same rows the running application does.
  await seedReferenceData(database.db);

  const clerkUsers = new Map<string, ClerkUserSnapshot>();
  const validWebhookSignatures = new Set<string>(['valid-signature']);
  const stripe = createFakeStripe();
  const storedObjects: RecordedObject[] = [];

  let storageAvailable = true;

  const storage: ObjectStorage = {
    put: async (key, body, contentType) => {
      storedObjects.push({ key, body, contentType });
      return publicUrlFor(TEST_ENV.S3_PUBLIC_URL, key);
    },
    checkAvailable: async () => {
      if (!storageAvailable) {
        throw new Error('Test storage bucket is unavailable');
      }
    },
  };

  const app = await buildServer({
    env: { ...TEST_ENV, ...options.env },
    db: database.db,
    storage,
    ...(options.loggerStream ? { loggerStream: options.loggerStream } : {}),
    ...(options.clock ? { clock: options.clock } : {}),
    auth: {
      // Tokens in the suites are literally the Clerk user id they stand for.
      verifySessionToken: async (token) => {
        if (!token.startsWith('token-')) {
          throw new Error('Unrecognised test token');
        }
        return token.slice('token-'.length);
      },
      loadClerkUser: async (clerkUserId) => {
        const snapshot = clerkUsers.get(clerkUserId);
        if (!snapshot) {
          throw new Error(`No test Clerk identity registered for ${clerkUserId}`);
        }
        return snapshot;
      },
    },
    webhooks: {
      verifySignature: (_payload, headers) => {
        if (!validWebhookSignatures.has(headers['svix-signature'] ?? '')) {
          throw new Error('Invalid test signature');
        }
        return undefined;
      },
    },
    stripe,
  });

  return {
    app,
    database,
    storedObjects,
    clerkUsers,
    validWebhookSignatures,
    stripe,
    setStorageAvailable: (available) => {
      storageAvailable = available;
    },
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

export function bearer(clerkUserId: string): Record<string, string> {
  return { authorization: `Bearer token-${clerkUserId}` };
}

export const SVIX_HEADERS = {
  'svix-id': 'msg_test',
  'svix-timestamp': '1700000000',
  'svix-signature': 'valid-signature',
} as const;
