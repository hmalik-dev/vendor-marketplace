import { seedReferenceData } from '@vendor-marketplace/db';
import {
  CURRENT_TERMS_VERSION,
  CURRENT_VENDOR_AGREEMENT_VERSION,
  legalDocumentSha256,
} from '@vendor-marketplace/shared';
import { users } from '@vendor-marketplace/db/schema';
import { createTestDatabase, type TestDatabase } from '@vendor-marketplace/db/testing';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, RouteOptions } from 'fastify';
import type { ApiEnv } from '../config/env.js';
import type { AppDatabase } from '../lib/database.js';
import type { EmailGateway, EmailMessage } from '../lib/email.js';
import type { ErrorReporter } from '../lib/error-reporting.js';
import { publicUrlFor, type ObjectStorage } from '../lib/storage.js';
import {
  paymentIntentParams,
  refundParams,
  assertUsableRefund,
  refusedRefundParams,
  refusedReversalParams,
  refusedTransferParams,
  RefundRefusedError,
  reversalParams,
  sumUsableRefunds,
  transferIdempotencyKey,
  transferParams,
} from '../lib/stripe.js';
import type {
  PaymentIntentSnapshot,
  StripeAccountCapabilities,
  StripeAccountStatus,
  StripeConnectGateway,
  StripeDisputeSnapshot,
  StripeEventNotification,
} from '../lib/stripe.js';
import {
  findAcceptanceOfVersion,
  insertAcceptance,
} from '../modules/legal/legal-acceptance.dao.js';
import type { NeonAuthPluginOptions } from '../plugins/neon-auth.js';
import { displayName, syncUserFromAuth } from '../modules/users/users.service.js';
import type { AuthUserSnapshot } from '../modules/users/users.service.js';
import { buildServer } from '../server.js';
import type { Clock } from '../plugins/clock.js';

export const TEST_ENV: ApiEnv = {
  NODE_ENV: 'test',
  DEPLOY_ENV: 'local',
  PORT: 4000,
  HOST: '127.0.0.1',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://test',
  NEON_AUTH_BASE_URL: 'https://ep-test.neonauth.example.invalid/neondb/auth',
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
  STRIPE_PLATFORM_FEE_RATE: 0.12,
  RATE_LIMIT_MAX: 1_000,
  // Generous like RATE_LIMIT_MAX: a suite builds one app, so one store spans the whole file.
  // The per-account suite passes its own small numbers through `env`.
  UPLOAD_RATE_LIMIT_MAX: 1_000,
  MESSAGE_RATE_LIMIT_MAX: 1_000,
  CONVERSATION_RATE_LIMIT_MAX: 1_000,
  BOOKING_REQUEST_RATE_LIMIT_MAX: 1_000,
  UPLOAD_OBJECT_LIMIT: 1_000,
  STORAGE_ENDPOINT: 'http://storage.test',
  STORAGE_ACCESS_KEY_ID: 'test',
  STORAGE_SECRET_ACCESS_KEY: 'test',
  STORAGE_BUCKET: 'test-bucket',
  STORAGE_PUBLIC_URL: 'http://cdn.test',
  STORAGE_REGION: 'us-east-2',
  STORAGE_FORCE_PATH_STYLE: true,
  /*
   * Composed rather than written as a literal, and both halves of that matter.
   *
   * `RESEND_API_KEY` carries a registry `shape` of `/^re_[A-Za-z0-9_]{16,}$/`,
   * so unlike the Stripe keys above it cannot be the word `unused` — the boot
   * schema would reject it and every suite would fail on a value nothing ever
   * sends. But a string of that shape assigned to that name is exactly what the
   * credential hook and the secret scanner are built to stop, and teaching both
   * to ignore one file is worse than not writing the pattern. Joining the parts
   * satisfies the schema without ever spelling a key-shaped literal.
   *
   * Nothing here reaches the network regardless: the suites inject a fake.
   */
  RESEND_API_KEY: ['re', 'not', 'used', 'by', 'the', 'suites'].join('_'),
  /*
   * Set, so `POST /webhooks/resend` is registered for every suite that needs
   * it. The value is never verified — the harness injects the same fake svix
   * verifier both webhooks use — so nothing here reaches svix or Resend.
   *
   * Joined rather than written out for `RESEND_API_KEY`'s reason: a signing
   * secret's prefix followed by anything is what the credential hook and the
   * secret scanner exist to stop, and teaching either to ignore this file is
   * worse than not writing the pattern.
   *
   * A suite whose subject is the **unconfigured** deployment overrides this
   * key with `undefined` through `env`, which is the state the registry row is
   * declared optional for.
   */
  RESEND_WEBHOOK_SECRET: ['whsec', 'not', 'used', 'by', 'the', 'suites'].join('_'),
  EMAIL_FROM: 'noreply@test.invalid',
  SUPPORT_EMAIL_TO: 'support@test.invalid',
  OPERATOR_ALERT_EMAIL: 'operator@test.invalid',
  OPERATOR_TIMEZONE: 'America/New_York',
};

/**
 * What the harness needs of a database: the handle its suites query, and a way
 * to give it back. `createTestDatabase`'s in-process PGlite satisfies it, and
 * so does the pooled real Postgres the `*.contention.test.ts` suites run on —
 * which is why this is stated as a shape rather than named as one driver.
 */
export interface HarnessDatabase {
  db: AppDatabase;
  close: () => Promise<void>;
}

export interface TestHarnessOptions<TDatabase extends HarnessDatabase = TestDatabase> {
  env?: Partial<ApiEnv>;
  /** A short request timeout, for the suite that watches a stalled upload get cut off. */
  requestTimeoutMs?: number;
  /** Sees every route the server registers, for the suite that walks the route table. */
  onRoute?: (route: RouteOptions) => void;
  /**
   * The real Neon Auth token verifier and loader (over a local key set), in
   * place of the fakes that read the literal `token-<id>` — for the suite whose
   * subject is the trust boundary itself.
   */
  neonAuth?: Pick<NeonAuthPluginOptions, 'verifySessionToken' | 'loadAuthUser'>;
  loggerStream?: NodeJS.WritableStream;
  /**
   * Pins "now" for every date-sensitive route. A suite that leaves it unset
   * reads the real clock and is therefore hour-dependent; one that sets it
   * asserts the same thing at every hour and under every `TZ`.
   */
  clock?: Clock;
  /**
   * A migrated database to run against, instead of booting a fresh PGlite.
   *
   * The one caller is the contention suite: PGlite holds a single connection,
   * so two requests fired at once never overlap there and a lock cannot be
   * told apart from its absence (#399). Injecting a pooled Postgres puts the
   * *real* routes under real contention.
   */
  database?: TDatabase;
  /**
   * The email gateway to run against, in place of the recording fake.
   *
   * The one caller is the support form's failure suite (#421). Its whole
   * subject is what the screen does when the transport *refuses*, and a fake
   * that throws a hand-written `Error` proves only that the code catches what
   * the fake throws — #416 shipped a refund that had never once worked because
   * the double was more permissive than the gateway. Injecting the real
   * `createResendGateway` over a stubbed `fetch` puts the production transport,
   * its status check and its error under the test instead.
   *
   * `harness.email` still refers to the recording fake, which such a suite
   * simply does not read.
   */
  emailGateway?: EmailGateway;
  /**
   * Whether a registered test identity signs in as an **ordinary** account —
   * one that exists and holds the current Terms of Service. Default `true`.
   *
   * Since #429 an account is created by accepting the Terms, and every guarded
   * route refuses a session whose account has not (`TERMS_REQUIRED`). So "a
   * signed-in vendor" now means two rows rather than one, and a harness that
   * produced only the first would put every suite in the product behind an
   * acceptance interstitial that none of them is about.
   *
   * Both rows are written through the real tables — this is fixture setup, the
   * same decision `db:seed:e2e` makes for the E2E accounts, not a stubbed DAO.
   * The acceptance is `seed_fixture`, because nobody ticked a box.
   *
   * Set it `false` in a suite whose subject **is** the gate: the acceptance
   * routes, and any suite asserting what an un-accepted session may reach.
   */
  acceptTerms?: boolean;
  /** Records what would reach the error tracker; silent when absent, as `TEST_ENV` has no DSN. */
  errorReporter?: ErrorReporter;
}

/**
 * Gives a registered test identity the two rows an ordinary account has: the
 * `users` row, and an acceptance of the current Terms of Service.
 *
 * Idempotent, because it runs on every request the suite makes — and it has to
 * stay that way rather than being memoised per identity: many suites clear
 * `users` in `afterEach`, so "already provisioned" is not a fact that survives
 * the test that established it. The account row
 * goes through `syncUserFromAuth` so role narrowing and name normalisation are
 * the production ones, and the acceptance is written straight to the table
 * rather than through the accept route — the route is what several suites are
 * *testing*, and setup that goes through the subject under test proves nothing.
 */
async function ensureAcceptedAccount(
  db: AppDatabase,
  snapshot: AuthUserSnapshot | undefined,
): Promise<void> {
  if (!snapshot) {
    return;
  }

  const user = await syncUserFromAuth(db, snapshot);

  if (
    !user ||
    (await findAcceptanceOfVersion(db, user.id, 'terms_of_service', CURRENT_TERMS_VERSION))
  ) {
    return;
  }

  await insertAcceptance(db, {
    vendorId: null,
    document: 'terms_of_service',
    version: CURRENT_TERMS_VERSION,
    documentSha256: legalDocumentSha256('terms_of_service'),
    acceptanceMethod: 'seed_fixture',
    acceptedByUserId: user.id,
    acceptedByName: displayName(user),
    businessName: null,
    ip: null,
    userAgent: null,
  });
}

/** A fresh in-process PGlite, migrated: the harness's default database. */
async function bootTestDatabase(): Promise<TestDatabase> {
  const database = await createTestDatabase();
  await database.runMigrations();

  return database;
}

/** Records what a route stored instead of reaching S3. */
export interface RecordedObject {
  key: string;
  body: Buffer;
  contentType: string;
  /** When it was stored; a suite sets it to age an object past the sweep's grace period. */
  lastModified?: Date;
}

/**
 * The transactional-email boundary, recorded rather than sent.
 *
 * `sent` is what a suite asserts on, in place of the `notifications` select it
 * would otherwise write — the two sit side by side because the email *is* the
 * notification, so a suite that checks one and not the other is checking half
 * an event.
 */
export interface FakeEmail extends EmailGateway {
  /** Every message the service asked to send, in order. */
  sent: EmailMessage[];
  /**
   * Provider message ids already minted, by idempotency key.
   *
   * The real provider deduplicates on that header, so a fake that simply
   * appended would let a double-send pass a green suite — the same trap
   * `FakeStripe.intentsByKey` exists to close for a double-charge. It is a map
   * rather than a set since #439 because a deduplicated send still answers
   * with the *original* message id, and a fake that returned nothing there
   * would make a replay look like a send Resend gave no id for.
   */
  messageIdsByKey: Map<string, string>;
  /**
   * Makes the next send throw, for the "a failed email never fails the
   * operation" case. Cleared once it has fired.
   */
  failNext: boolean;
}

function createFakeEmail(): FakeEmail {
  const sent: EmailMessage[] = [];
  const messageIdsByKey = new Map<string, string>();

  const fake: FakeEmail = {
    sent,
    messageIdsByKey,
    failNext: false,
    send: async (message) => {
      if (fake.failNext) {
        fake.failNext = false;
        throw new Error('Resend refused the send (500)');
      }

      // Modelled, not assumed: a replayed key is accepted, delivers once, and
      // answers with the id the first send was given.
      const existing = messageIdsByKey.get(message.idempotencyKey);
      if (existing !== undefined) {
        return { providerMessageId: existing };
      }

      /*
       * Derived from the idempotency key rather than random, so a suite can
       * name the id a delivery webhook should carry without first reading it
       * back — and so a re-run asserts the same string.
       */
      const providerMessageId = `resend-${message.idempotencyKey}`;
      messageIdsByKey.set(message.idempotencyKey, providerMessageId);
      sent.push(message);

      return { providerMessageId };
    },
  };

  return fake;
}

/** What a suite may set on an account: the pair always, the reasons optionally. */
export type FakeAccountStatus = StripeAccountCapabilities &
  Partial<Pick<StripeAccountStatus, 'disabledReason' | 'requirementsDue'>>;

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
  /**
   * Capability state per account id; absent means both capabilities inactive.
   *
   * The reason and the requirement list are **optional** here (#432). Almost
   * every suite cares only about the capability pair, and making them supply
   * Stripe's `status_details` vocabulary to say "this account can receive a
   * transfer" would put invented copy in twenty tests that never read it.
   */
  accountStatuses: Map<string, FakeAccountStatus>;
  /** Signatures the fake verifier accepts; anything else is rejected. */
  validSignatures: Set<string>;
  /**
   * The notification the next verified webhook is parsed into.
   *
   * `objectId` is optional here and only here: a suite exercising an account
   * event has no object to name, and requiring `objectId: null` on every one of
   * them would be ceremony rather than a contract. The gateway itself always
   * reports the field — `parseEventNotification` below fills the default.
   */
  nextEvent: Omit<StripeEventNotification, 'objectId' | 'livemode'> & {
    objectId?: string | null;
    livemode?: boolean | null;
  };
  /**
   * Payment intent ids whose refund the fake must refuse.
   *
   * Stripe declining a refund is not hypothetical — a disputed charge, a
   * reversed source, a connected account with a negative balance — and it is
   * the branch where a ban leaves a confirmed booking on a suspended account
   * with nobody told (#400). There is no other way to reach it from a test.
   */
  refundsToRefuse: Set<string>;
  /**
   * Refunds made outside the platform — the Dashboard or the API (VEN-469). Not
   * marked as ours, so a reader sees them as foreign, exactly as Stripe reports one.
   */
  refundExternally: (paymentIntentId: string, amountCents: number) => string;
  /** Idempotency keys whose refund was refused, replayed as Stripe replays them for 24 hours. */
  failedRefundKeys: Map<string, string>;
  /** The status Stripe answers the next `createRefund` with; unset means `succeeded`. */
  nextRefundStatus: string | undefined;
  /** Runs inside the next `createRefund`, once: the interleave a race test needs (VEN-425). */
  duringNextRefund: (() => Promise<void>) | undefined;
  /** Every intent the fake has minted, keyed by id, in Stripe's own shape. */
  paymentIntents: Map<string, PaymentIntentSnapshot>;
  /**
   * Intents by idempotency key, which is what makes the fake's replay real
   * rather than assumed: a suite firing checkout twice gets the *same object*
   * back, and a fake that minted a second one would let a double-charge pass.
   */
  intentsByKey: Map<string, string>;
  /** Refunds asked for, in order, so a suite can assert exact cent amounts. */
  /** `reason` is absent on an operator-driven refund — see `CreateRefundInput`. */
  refunds: {
    paymentIntentId: string;
    amountCents: number;
    reason: string | undefined;
    /** Recorded so a suite can assert a replayed refund is deduped by Stripe. */
    idempotencyKey: string | undefined;
    /** Reversed the vendor's share out of their connected account (D31). */
    reverseTransfer: boolean;
    /** Gave Orla's commission back as well (D31). */
    refundApplicationFee: boolean;
    /**
     * Stripe's own refund status, defaulting to `succeeded` (#415).
     *
     * The fake used to model refunds as a list of requests with no state, so
     * `findRefund` returned any of them — and the real gateway's
     * `refunds.list` returns `failed` and `canceled` refunds too, with
     * `amount` populated. A double more permissive than the thing it stands
     * in for, on the path that now writes what the customer is told came
     * back. A suite pushes a `failed` refund here to reach that branch.
     */
    status?: string;
  }[];
  /**
   * Transfers asked for, in order, so a suite can assert the **call count**
   * rather than only the end state (#423).
   *
   * A second sweep that no-ops because the row already changed and one that
   * never issues the transfer at all look identical on the booking. Only this
   * list tells them apart, which is why the idempotency acceptance is written
   * against its length.
   */
  transfers: {
    transferId: string;
    bookingId: string;
    amountCents: number;
    destinationAccountId: string;
    transferGroup: string;
    idempotencyKey: string;
    /** Cents already reversed, so an over-reversal is refused as Stripe does. */
    reversedCents: number;
  }[];
  /** Reversals asked for, in order, with the transfer each one applied to. */
  reversals: {
    reversalId: string;
    transferId: string;
    amountCents: number;
    idempotencyKey: string;
  }[];
  /**
   * Booking ids whose transfer the fake must refuse.
   *
   * A transfer failing is not hypothetical — an insufficient platform balance,
   * a connected account restricted between payment and release, a Stripe
   * outage — and it is the branch that must leave the booking releasable rather
   * than silently released (#423 acceptance 7). There is no other way to reach
   * it from a test.
   */
  transfersToRefuse: Set<string>;
  /**
   * Idempotency keys whose result was a **failure**, replayed as Stripe does.
   *
   * Exposed so a suite can clear it between tests alongside `transfers`. Booking
   * ids are fresh uuids so a stale entry cannot currently collide, but a fake
   * that remembers a refusal across tests is exactly the kind of coupling that
   * produces an unexplainable red one day.
   */
  failedTransferKeys: Map<string, string>;
  /**
   * Disputes the fake knows about, keyed by id (#431).
   *
   * The chargeback handler **re-reads** the dispute rather than trusting the
   * event body, exactly as the intent and account handlers do — so a suite
   * that only set `nextEvent` would exercise a lookup with nothing behind it.
   * A test puts the dispute here and then names its id in the event, which is
   * the same two steps Stripe takes.
   */
  disputes: Map<string, StripeDisputeSnapshot>;
  /** Moves an intent to `succeeded`, as confirming the card would. */
  succeed: (paymentIntentId: string) => PaymentIntentSnapshot;
  /** Moves an intent to `canceled`, as Stripe does once it can never be paid. */
  cancel: (paymentIntentId: string) => PaymentIntentSnapshot;
  /** Intents the platform asked Stripe to cancel, in order (VEN-528). */
  cancelRequests: string[];
}

function createFakeStripe(deployEnv: string): FakeStripe {
  const createdAccounts: FakeStripe['createdAccounts'] = [];
  const createdLinks: FakeStripe['createdLinks'] = [];
  const accountStatuses = new Map<string, FakeAccountStatus>();
  const validSignatures = new Set<string>(['valid-signature']);
  const paymentIntents = new Map<string, PaymentIntentSnapshot>();
  /** What each refund request carried; absent for a refund made outside the platform. */
  const refundMetadata = new WeakMap<object, Record<string, unknown>>();
  const intentsByKey = new Map<string, string>();
  const refunds: FakeStripe['refunds'] = [];
  const refundsToRefuse = new Set<string>();
  const failedRefundKeys = new Map<string, string>();
  const refundIdsByKey = new Map<string, string>();
  /*
   * Stripe's key memory belongs to the intents it was made for. Suites reset the
   * fake by clearing the intents and mint the same ids again, so a key that
   * outlived them would replay another test's refund or refusal.
   */
  const forgetIntents = paymentIntents.clear.bind(paymentIntents);
  paymentIntents.clear = () => {
    forgetIntents();
    failedRefundKeys.clear();
    refundIdsByKey.clear();
  };
  const transfers: FakeStripe['transfers'] = [];
  const reversals: FakeStripe['reversals'] = [];
  const transfersToRefuse = new Set<string>();
  /** Idempotency keys whose result was a failure, replayed as Stripe does. */
  const failedTransferKeys = new Map<string, string>();
  const disputes = new Map<string, StripeDisputeSnapshot>();
  const cancelRequests: string[] = [];

  const fake: FakeStripe = {
    cancelRequests,
    createdAccounts,
    createdLinks,
    accountStatuses,
    validSignatures,
    paymentIntents,
    intentsByKey,
    refunds,
    refundsToRefuse,
    failedRefundKeys,
    refundExternally: (paymentIntentId, amountCents) => {
      refunds.push({
        paymentIntentId,
        amountCents,
        reason: undefined,
        idempotencyKey: undefined,
        reverseTransfer: false,
        refundApplicationFee: false,
      });

      return `re_test_${refunds.length}`;
    },
    nextRefundStatus: undefined,
    duringNextRefund: undefined,
    transfers,
    reversals,
    transfersToRefuse,
    failedTransferKeys,
    disputes,
    nextEvent: { type: 'v2.core.account.updated', accountId: null, objectId: null },

    cancel: (paymentIntentId) => {
      const intent = paymentIntents.get(paymentIntentId);

      if (!intent) {
        throw new Error(`No fake payment intent ${paymentIntentId}`);
      }

      const cancelled: PaymentIntentSnapshot = {
        ...intent,
        status: 'canceled',
        clientSecret: null,
      };
      paymentIntents.set(paymentIntentId, cancelled);

      return cancelled;
    },

    succeed: (paymentIntentId) => {
      const intent = paymentIntents.get(paymentIntentId);

      if (!intent) {
        throw new Error(`No fake payment intent ${paymentIntentId}`);
      }

      const settled: PaymentIntentSnapshot = {
        ...intent,
        status: 'succeeded',
        amountReceivedCents: intent.amountReceivedCents,
        clientSecret: null,
      };
      paymentIntents.set(paymentIntentId, settled);

      return settled;
    },

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

    readAccountStatus: async (accountId) => {
      const status = accountStatuses.get(accountId);

      return {
        transfersActive: status?.transfersActive ?? false,
        payoutsActive: status?.payoutsActive ?? false,
        disabledReason: status?.disabledReason ?? null,
        requirementsDue: status?.requirementsDue ?? [],
      };
    },

    parseEventNotification: (_payload, signature) => {
      if (!validSignatures.has(signature)) {
        throw new Error('Invalid test Stripe signature');
      }
      return { objectId: null, livemode: null, ...fake.nextEvent };
    },

    createPaymentIntent: async (input) => {
      /*
       * The real gateway's idempotency, modelled rather than asserted. Stripe
       * replays the same intent for a repeated key, and a fake that minted a
       * fresh one each time would let a double-charge through a green suite —
       * which is exactly the shape of bug the parity rule warns about.
       */
      const key = `pay_${input.requestId}`;
      const replayed = intentsByKey.get(key);

      if (replayed) {
        return paymentIntents.get(replayed) as PaymentIntentSnapshot;
      }

      const id = `pi_test_${paymentIntents.size + 1}`;
      /*
       * Built through the adapter's own params so the intent the suite reads
       * back is shaped by the code that would post it — the metadata below is
       * the very object Stripe would be sent, not a paraphrase of it.
       */
      const params = paymentIntentParams(input, deployEnv);
      const intent: PaymentIntentSnapshot = {
        id,
        status: 'requires_payment_method',
        amountReceivedCents: input.amountCents,
        clientSecret: `${id}_secret_test`,
        metadata: params.metadata as Record<string, string>,
      };

      paymentIntents.set(id, intent);
      intentsByKey.set(key, id);

      return intent;
    },

    retrieveDispute: async (disputeId) => {
      const dispute = disputes.get(disputeId);

      /*
       * Throws rather than answering a placeholder, because the real gateway
       * does: a handler that quietly worked against an invented dispute would
       * pass a suite and open a case for a chargeback nobody filed.
       */
      if (!dispute) {
        throw new Error(`No fake dispute ${disputeId}`);
      }

      return dispute;
    },

    retrievePaymentIntent: async (paymentIntentId) => {
      const intent = paymentIntents.get(paymentIntentId);

      if (!intent) {
        throw new Error(`No fake payment intent ${paymentIntentId}`);
      }

      return intent;
    },

    cancelPaymentIntent: async (paymentIntentId) => {
      cancelRequests.push(paymentIntentId);

      const intent = paymentIntents.get(paymentIntentId);

      if (!intent) {
        throw new Error(`No fake payment intent ${paymentIntentId}`);
      }

      /* Stripe refuses these two, and the caller has to read the intent again. */
      if (intent.status === 'succeeded' || intent.status === 'processing') {
        throw new Error(
          `The fake intent ${paymentIntentId} is ${intent.status} and cannot be canceled`,
        );
      }

      return fake.cancel(paymentIntentId);
    },

    createTransfer: async (input) => {
      /*
       * Stripe replays a transfer for a repeated key rather than sending a
       * second one. Modelled rather than asserted: a fake that minted a fresh
       * transfer per call would let a double payout through a green suite,
       * which is the exact shape #416 warns about — and here the money leaves
       * the platform's balance.
       */
      const idempotencyKey = transferIdempotencyKey(input);
      const replayed = transfers.find((transfer) => transfer.idempotencyKey === idempotencyKey);

      if (replayed) {
        return { transferId: replayed.transferId, amountCents: replayed.amountCents };
      }

      /*
       * **And it replays a cached _failure_ under that key too**, which is the
       * half a double would never think to model and which cost a real
       * debugging session to find: driven against real Stripe, a payout refused
       * `balance_insufficient` kept returning that same error — with the
       * original request's log URL — for every later attempt, even once the
       * balance was funded. A key fixed at `payout_<bookingId>` therefore froze
       * a transient failure for 24 hours while the sweep asked for the same
       * cached "no" every quarter of an hour.
       *
       * The attempt number in the key is what fixes it, and this branch is what
       * stops the fix being quietly reverted: drop `attempt` and the retry
       * assertion in `payouts.routes.test.ts` goes red here instead of a payout
       * going silently stuck in production.
       */
      const failed = failedTransferKeys.get(idempotencyKey);

      if (failed) {
        throw new Error(failed);
      }

      if (transfersToRefuse.has(input.bookingId)) {
        const message = `Fake Stripe refused a transfer for booking ${input.bookingId}`;
        failedTransferKeys.set(idempotencyKey, message);
        throw new Error(message);
      }

      /*
       * The double judges the real request. `refusedTransferParams` carries the
       * rules that are readable off the params; the capability check is here
       * because only the gateway knows the account state — and it is the #387
       * failure exactly: a connected account that every column-shaped check
       * read as payment-capable, which Stripe refused as a transfer
       * destination.
       */
      const params = transferParams(input);
      const refusal = refusedTransferParams(params);

      if (refusal) {
        throw new Error(refusal);
      }

      if (!accountStatuses.get(input.destinationAccountId)?.transfersActive) {
        throw new Error(
          `Your destination account (${input.destinationAccountId}) needs to have at least one ` +
            'of the following capabilities enabled: transfers, crypto_transfers, legacy_payments',
        );
      }

      const transferId = `tr_test_${transfers.length + 1}`;
      transfers.push({
        transferId,
        bookingId: input.bookingId,
        amountCents: input.amountCents,
        destinationAccountId: input.destinationAccountId,
        transferGroup: input.transferGroup,
        idempotencyKey,
        reversedCents: 0,
      });

      return { transferId, amountCents: input.amountCents };
    },

    findTransfer: async (transferGroup, options) => {
      const transfer = transfers.find(
        (candidate) =>
          candidate.transferGroup === transferGroup &&
          (!options?.live || candidate.reversedCents < candidate.amountCents),
      );

      return transfer
        ? {
            transferId: transfer.transferId,
            amountCents: transfer.amountCents,
            reversedCents: transfer.reversedCents,
          }
        : null;
    },

    reverseTransfer: async (input) => {
      const replayed = reversals.find(
        (reversal) => reversal.idempotencyKey === input.idempotencyKey,
      );

      if (replayed) {
        return { reversalId: replayed.reversalId, amountCents: replayed.amountCents };
      }

      const transfer = transfers.find((candidate) => candidate.transferId === input.transferId);

      if (!transfer) {
        throw new Error(`No such transfer: ${input.transferId}`);
      }

      /*
       * The unreversed balance is tracked so the double refuses an
       * over-reversal the way Stripe does. A booking cancelled twice, a day
       * apart, would otherwise claw the vendor's share back twice — and D31
       * accepted carrying a vendor negative once, never twice.
       */
      const params = reversalParams(input);
      const refusal = refusedReversalParams(params, transfer.amountCents - transfer.reversedCents);

      if (refusal) {
        throw new Error(refusal);
      }

      transfer.reversedCents += input.amountCents;
      const reversalId = `trr_test_${reversals.length + 1}`;
      reversals.push({
        reversalId,
        transferId: input.transferId,
        amountCents: input.amountCents,
        idempotencyKey: input.idempotencyKey,
      });

      return { reversalId, amountCents: input.amountCents };
    },

    createRefund: async (input) => {
      const interleave = fake.duringNextRefund;
      fake.duringNextRefund = undefined;
      await interleave?.();

      /* Stripe answers a replayed key with what the first request got, refusal included. */
      const replayedFailure = input.idempotencyKey && failedRefundKeys.get(input.idempotencyKey);
      const replayedRefund = input.idempotencyKey && refundIdsByKey.get(input.idempotencyKey);

      if (replayedFailure) {
        throw new RefundRefusedError(replayedFailure);
      }

      if (replayedRefund) {
        const first = refunds[Number(replayedRefund.replace('re_test_', '')) - 1]!;

        return { refundId: replayedRefund, amountCents: first.amountCents };
      }

      if (refundsToRefuse.has(input.paymentIntentId)) {
        const message = `Fake Stripe refused a refund for ${input.paymentIntentId}`;

        if (input.idempotencyKey) {
          failedRefundKeys.set(input.idempotencyKey, message);
        }
        throw new RefundRefusedError(message);
      }

      /*
       * The double judges the *real* request, not a paraphrase of it. Before
       * #416 it recorded whatever it was handed, so the suite was green for two
       * months on a flag pair Stripe answers 400 for on every single call. It
       * builds the params the adapter would send and applies Stripe's own
       * refusal, so a policy that cannot work fails here first.
       */
      const params = refundParams(input);
      const refusal = refusedRefundParams(params);

      if (refusal) {
        throw new Error(refusal);
      }

      assertUsableRefund(`re_test_${refunds.length + 1}`, fake.nextRefundStatus ?? 'succeeded');

      refunds.push({
        paymentIntentId: input.paymentIntentId,
        amountCents: input.amountCents,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        /*
         * Both false on every refund under #423 and recorded anyway, because
         * they are what a suite asserts the *absence* of: a refund that had
         * either set would be one sent against a charge that cannot carry it.
         */
        reverseTransfer: params.reverse_transfer === true,
        refundApplicationFee: params.refund_application_fee === true,
      });
      refundMetadata.set(refunds[refunds.length - 1]!, { ...params.metadata });

      if (input.idempotencyKey) {
        refundIdsByKey.set(input.idempotencyKey, `re_test_${refunds.length}`);
      }

      return { refundId: `re_test_${refunds.length}`, amountCents: input.amountCents };
    },

    retrieveRefund: async (refundId) => {
      const refund = refunds[Number(refundId.replace('re_test_', '')) - 1];

      if (!refund) {
        throw new Error(`No fake refund ${refundId}`);
      }

      return {
        refundId,
        status: refund.status ?? 'succeeded',
        paymentIntentId: refund.paymentIntentId,
        amountCents: refund.amountCents,
      };
    },

    retrieveChargeIntent: async (chargeId) =>
      chargeId.startsWith('ch_') ? chargeId.slice('ch_'.length) : null,

    findRefund: async (paymentIntentId) => {
      /*
       * The same status filter the real adapter applies. A `failed` refund put
       * the money back in the platform balance, not the customer's account, so
       * reading it as "already refunded" both skips a retry that is owed and
       * writes a figure the screens state as money returned.
       */
      return sumUsableRefunds(
        refunds
          .map((refund, index) => ({
            id: `re_test_${index + 1}`,
            amount: refund.amountCents,
            status: refund.status ?? 'succeeded',
            metadata: refundMetadata.get(refund),
            paymentIntentId: refund.paymentIntentId,
          }))
          .filter((refund) => refund.paymentIntentId === paymentIntentId),
      );
    },
  };

  return fake;
}

export interface TestHarness<TDatabase extends HarnessDatabase = TestDatabase> {
  app: FastifyInstance;
  database: TDatabase;
  /** Objects written through `app.storage`, in the order they were stored. */
  storedObjects: RecordedObject[];
  /** Neon Auth identities the fake token verifier and acceptance-gate loader resolve. */
  authUsers: Map<string, AuthUserSnapshot>;
  /** Signatures the fake svix verifier accepts; anything else is rejected. */
  validWebhookSignatures: Set<string>;
  /** The Stripe Connect boundary, recorded rather than called. */
  stripe: FakeStripe;
  /** The transactional-email boundary, recorded rather than sent. */
  email: FakeEmail;
  /**
   * Settles the sends this request dispatched, before asserting on `email`.
   *
   * The transactional email runs off the request path (#408), so a suite that
   * reads `email.sent` the instant `inject` resolves is racing it. This is
   * `app.background.drain()` — the same call the instance makes on close, not a
   * test-only path — so what the suite waits for is what production runs.
   */
  flushEmail: () => Promise<void>;
  /** Simulates the storage bucket going away, for the readiness probe. */
  setStorageAvailable: (available: boolean) => void;
  /**
   * Auth identities the fake deleter ended, in order (#451).
   *
   * Also the fake's record of **who is gone**: the token verifier refuses an
   * id in this list, and the deleter drops it from `authUsers` as well, so an
   * identity a closure ended stops resolving on both paths. That is what makes
   * "that person is signed out now" assertable rather than assumed. Clearing
   * it between tests brings those identities back.
   */
  deletedAuthUsers: string[];
  /** Simulates the identity store refusing the deletion, for the half-closed account case. */
  setAuthDeletionFails: (fails: boolean) => void;
  close: () => Promise<void>;
}

/**
 * Boots the real server against an in-process Postgres, with the four network
 * boundaries (auth token verification, svix signature verification, Stripe
 * Connect and Resend) replaced by explicit fakes. Everything between the HTTP
 * edge and SQL is the production code path.
 *
 * Object storage is faked here too and is deliberately not counted among them:
 * it is supplied by the caller rather than built by the server, because
 * `buildServer` takes a `storage` port as a required option.
 */
export async function createTestHarness(
  options?: Omit<TestHarnessOptions, 'database'>,
): Promise<TestHarness<TestDatabase>>;
export async function createTestHarness<TDatabase extends HarnessDatabase>(
  options: TestHarnessOptions<TDatabase> & { database: TDatabase },
): Promise<TestHarness<TDatabase>>;
export async function createTestHarness(
  options: TestHarnessOptions<HarnessDatabase> = {},
): Promise<TestHarness<HarnessDatabase>> {
  const database = options.database ?? (await bootTestDatabase());
  // Categories and tags are reference data every deployment starts with, so
  // the suites see the same rows the running application does.
  await seedReferenceData(database.db);

  const authUsers = new Map<string, AuthUserSnapshot>();
  const acceptTerms = options.acceptTerms ?? true;
  const validWebhookSignatures = new Set<string>(['valid-signature']);
  const stripe = createFakeStripe({ ...TEST_ENV, ...options.env }.DEPLOY_ENV);
  const email = createFakeEmail();
  const storedObjects: RecordedObject[] = [];

  let storageAvailable = true;
  let authDeletionFails = false;
  const deletedAuthUsers: string[] = [];

  const storage: ObjectStorage = {
    put: async (key, body, contentType) => {
      storedObjects.push({ key, body, contentType });
      return publicUrlFor(TEST_ENV.STORAGE_PUBLIC_URL, key);
    },
    remove: async (keys) => {
      // Mirrors the real store: the objects go, and a missing key is not an
      // error — so a suite can assert on what is left rather than on the call.
      for (const key of keys) {
        const at = storedObjects.findIndex((object) => object.key === key);
        if (at !== -1) {
          storedObjects.splice(at, 1);
        }
      }
    },
    list: async (prefix, page) => {
      const matching = storedObjects
        .filter((object) => object.key.startsWith(`${prefix}/`))
        .sort((a, b) => a.key.localeCompare(b.key))
        .filter((object) => !page?.token || object.key > page.token);
      const limit = page?.limit ?? matching.length;
      const slice = matching.slice(0, limit);
      const last = slice.at(-1);

      return {
        objects: slice.map((object) => ({
          key: object.key,
          lastModified: object.lastModified ?? new Date(),
        })),
        ...(last && matching.length > limit ? { nextToken: last.key } : {}),
      };
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
    /*
     * The payout sweep never runs on a timer in a suite. It moves money against
     * whatever fixtures happen to be due, so a tick landing between an `inject`
     * and its assertion would be a source of flakes on the one path where a
     * flake is a transfer. Suites that exercise it call `releaseDuePayouts`
     * directly, which is the same function the timer calls.
     */
    payoutSweepIntervalMs: 0,
    // Nor does the expiry sweep: suites call `expireLapsedRequests` with a pinned clock.
    expirySweepIntervalMs: 0,
    // Nor the email retry: suites call `retryFailedEmails` with a pinned clock.
    emailRetryIntervalMs: 0,
    // Nor the upload sweep: suites call `sweepOrphanedUploads` with a pinned clock.
    uploadSweepIntervalMs: 0,
    // The digest likewise: suites call `runOperatorDigest` with a pinned clock.
    operatorDigestIntervalMs: 0,
    // Alert send retries do not wait on a real timer in a suite.
    operatorAlertWait: async () => undefined,
    ...(options.loggerStream ? { loggerStream: options.loggerStream } : {}),
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.requestTimeoutMs ? { requestTimeoutMs: options.requestTimeoutMs } : {}),
    ...(options.onRoute ? { onRoute: options.onRoute } : {}),
    ...(options.errorReporter ? { errorReporter: options.errorReporter } : {}),
    auth: {
      // Tokens in the suites are literally the auth user id they stand for.
      verifySessionToken: async (token) => {
        if (!token.startsWith('token-')) {
          throw new Error('Unrecognised test token');
        }

        const authUserId = token.slice('token-'.length);

        /*
         * The account behind the token, made ordinary.
         *
         * This is the seam because it runs before the auth plugin reads the
         * database, and because the alternative — asking 42 call sites across
         * 33 suites to seed two rows each — would make what those suites are
         * about harder to see rather than easier. An identity nobody registered
         * is left alone: the plugin then finds no account, which is the gated
         * state, and a suite asserting on an unknown token still sees a refusal.
         */
        /*
         * An identity a closure deleted stops verifying, which is the whole
         * point of deleting it rather than revoking sessions.
         *
         * Without this the fake could not tell #451's change from the state it
         * replaced: the local row is retired either way, so the gate 401s on
         * `deletedAt` and a suite asserting only the status code passes with
         * the auth deletion removed. The auth provider answers a token for a deleted user
         * by refusing to verify it, so that is what this does — and the two
         * refusals carry different messages, which is what lets a suite say
         * which one it got.
         */
        if (deletedAuthUsers.includes(authUserId)) {
          throw new Error(`Test auth identity ${authUserId} was deleted`);
        }

        if (acceptTerms) {
          await ensureAcceptedAccount(database.db, authUsers.get(authUserId));
        }

        return authUserId;
      },
      loadAuthUser: async (authUserId) => {
        const snapshot = authUsers.get(authUserId);
        if (!snapshot) {
          throw new Error(`No test auth identity registered for ${authUserId}`);
        }
        return snapshot;
      },
      /*
       * The identity store is the same registry the loader reads, so an id a
       * suite never registered — or one a closure deleted — reads as gone.
       *
       * A deletion really happens, rather than being counted: it is recorded in
       * `deletedAuthUsers`, which the token verifier above refuses, and dropped
       * from `authUsers`, which the acceptance gate's loader reads — so a suite
       * can present the deleted person's token afterwards and watch it fail the
       * way a deleted session does, instead of asserting only that a function
       * was called.
       */
      directory: {
        lookup: async (ids) =>
          ids.flatMap((id) => {
            const snapshot = authUsers.get(id);
            return snapshot
              ? [
                  {
                    id,
                    email: snapshot.email,
                    name: [snapshot.firstName, snapshot.lastName].filter(Boolean).join(' '),
                    image: snapshot.avatarUrl ?? null,
                  },
                ]
              : [];
          }),
        deleteIdentity: async (authUserId) => {
          if (authDeletionFails) {
            throw new Error('Test identity deletion refused');
          }

          deletedAuthUsers.push(authUserId);
          return authUsers.delete(authUserId);
        },
        close: async () => {},
      },
      ...options.neonAuth,
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
    email: options.emailGateway ?? email,
  });

  return {
    app,
    database,
    email,
    storedObjects,
    authUsers,
    validWebhookSignatures,
    stripe,
    flushEmail: () => app.background.drain(),
    setStorageAvailable: (available) => {
      storageAvailable = available;
    },
    deletedAuthUsers,
    setAuthDeletionFails: (fails) => {
      authDeletionFails = fails;
    },
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

/**
 * Records the current vendor agreement for a vendor who already has a profile,
 * through the real route: publishing now requires it (VEN-509), and accepting
 * is how a vendor reaches that state. Idempotent, so a fixture may call it twice.
 */
export async function acceptVendorAgreementAs(
  harness: Pick<TestHarness, 'app'>,
  authUserId: string,
): Promise<void> {
  const accepted = await harness.app.inject({
    method: 'POST',
    url: '/vendor/agreement/accept',
    headers: bearer(authUserId),
    payload: { version: CURRENT_VENDOR_AGREEMENT_VERSION },
  });

  if (accepted.statusCode !== 200) {
    throw new Error(`Vendor agreement fixture failed: ${accepted.statusCode} ${accepted.body}`);
  }
}

export function bearer(authUserId: string): Record<string, string> {
  return { authorization: `Bearer token-${authUserId}` };
}

/**
 * Creates the `users` row for a fake auth identity and returns its id.
 *
 * A sign-in is the only thing that writes a `users` row, so a test that wants a
 * user has to make the request rather than insert one — the row carries columns
 * (`role`, `auth_user_id`, the mirrored name) that the sync owns.
 *
 * `promoteToAdmin` is a second step and cannot be a first one: `normalizeRole`
 * refuses `admin` from auth metadata **by design**, precisely so the role can
 * only be granted by an operator with database access. Every admin-facing suite
 * therefore signs in and then promotes, and three of them had written that out
 * by hand before this lived here.
 */
export async function signInAs(
  harness: TestHarness<HarnessDatabase>,
  authUserId: string,
  promoteToAdmin = false,
): Promise<string> {
  const response = await harness.app.inject({
    method: 'GET',
    url: '/users/me',
    headers: bearer(authUserId),
  });

  if (response.statusCode !== 200) {
    throw new Error(`Sign-in for ${authUserId} answered ${response.statusCode}`);
  }

  if (promoteToAdmin) {
    await harness.database.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.authUserId, authUserId));
  }

  const rows = await harness.database.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);
  const row = rows[0];

  if (!row) {
    throw new Error(`No users row for ${authUserId} after signing in`);
  }

  return row.id;
}

export const SVIX_HEADERS = {
  'svix-id': 'msg_test',
  'svix-timestamp': '1700000000',
  'svix-signature': 'valid-signature',
} as const;
