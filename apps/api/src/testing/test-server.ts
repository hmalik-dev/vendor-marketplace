import { seedReferenceData } from '@vendorhub/db';
import { createTestDatabase, type TestDatabase } from '@vendorhub/db/testing';
import type { FastifyInstance } from 'fastify';
import type { ApiEnv } from '../config/env.js';
import { publicUrlFor, type ObjectStorage } from '../lib/storage.js';
import type { ClerkUserSnapshot } from '../modules/users/users.service.js';
import { buildServer } from '../server.js';

export const TEST_ENV: ApiEnv = {
  NODE_ENV: 'test',
  PORT: 4000,
  HOST: '127.0.0.1',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://test',
  CLERK_SECRET_KEY: 'sk_test_not_used',
  CLERK_WEBHOOK_SECRET: 'whsec_not_used',
  WEB_URL: 'http://localhost:3000',
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
}

/** Records what a route stored instead of reaching S3. */
export interface RecordedObject {
  key: string;
  body: Buffer;
  contentType: string;
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
  close: () => Promise<void>;
}

/**
 * Boots the real server against an in-process Postgres, with the two network
 * boundaries (Clerk token verification and svix signature verification)
 * replaced by explicit fakes. Everything between the HTTP edge and SQL is the
 * production code path.
 */
export async function createTestHarness(options: TestHarnessOptions = {}): Promise<TestHarness> {
  const database = await createTestDatabase();
  await database.runMigrations();
  // Categories and tags are reference data every deployment starts with, so
  // the suites see the same rows the running application does.
  await seedReferenceData(database.db);

  const clerkUsers = new Map<string, ClerkUserSnapshot>();
  const validWebhookSignatures = new Set<string>(['valid-signature']);
  const storedObjects: RecordedObject[] = [];

  const storage: ObjectStorage = {
    put: async (key, body, contentType) => {
      storedObjects.push({ key, body, contentType });
      return publicUrlFor(TEST_ENV.S3_PUBLIC_URL, key);
    },
  };

  const app = await buildServer({
    env: { ...TEST_ENV, ...options.env },
    db: database.db,
    storage,
    ...(options.loggerStream ? { loggerStream: options.loggerStream } : {}),
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
  });

  return {
    app,
    database,
    storedObjects,
    clerkUsers,
    validWebhookSignatures,
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
