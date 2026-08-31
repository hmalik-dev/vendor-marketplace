import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME, NOTIFICATION_TYPES } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import type { EmailMessage } from '../../lib/email.js';
import { sendNotificationEmail, type NotificationEmailDeps } from './notification-email.js';

/*
 * The unit half of #11. The route suites assert that each event reaches an
 * inbox at all; this asserts what the message *is* — and the two guards at the
 * bottom assert what it may never contain.
 */

function deps(overrides: Partial<NotificationEmailDeps> = {}): {
  deps: NotificationEmailDeps;
  sent: EmailMessage[];
  errors: unknown[][];
} {
  const sent: EmailMessage[] = [];
  const errors: unknown[][] = [];

  return {
    sent,
    errors,
    deps: {
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ email: 'reader@example.test' }],
            }),
          }),
        }),
      } as unknown as NotificationEmailDeps['db'],
      email: {
        send: async (message) => {
          sent.push(message);
        },
      },
      log: {
        error: (...args: unknown[]) => errors.push(args),
        info: () => undefined,
      } as unknown as NotificationEmailDeps['log'],
      webOrigin: 'https://web.test',
      ...overrides,
    },
  };
}

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  type: 'booking_confirmed',
  title: 'June 14 is confirmed',
  body: 'Payment is held until the event is complete.',
};

describe('sendNotificationEmail', () => {
  it('carries the notification’s own subject and body, so the two cannot drift', async () => {
    const { deps: d, sent } = deps();

    await sendNotificationEmail(d, ROW);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toBe('June 14 is confirmed');
    expect(sent[0]?.html).toContain('Payment is held until the event is complete.');
    expect(sent[0]?.text).toContain('Payment is held until the event is complete.');
  });

  /*
   * The row's uuid, which exists exactly once per event. It is what makes a
   * retried operation deliver once without a column, a table or a read-before-
   * write that would race with itself.
   */
  it('keys the send on the notification id, so a replay cannot deliver twice', async () => {
    const { deps: d, sent } = deps();

    await sendNotificationEmail(d, ROW);

    expect(sent[0]?.idempotencyKey).toBe(ROW.id);
  });

  it('sends one action, pointed at the reader’s own side of the product', async () => {
    const { deps: d, sent } = deps();

    await sendNotificationEmail(d, ROW, 'customer');
    await sendNotificationEmail(d, { ...ROW, id: 'other' }, 'vendor');

    expect(sent[0]?.text).toContain('https://web.test/bookings');
    expect(sent[1]?.text).toContain('https://web.test/vendor/bookings');
    // One action, not two — a second link is a second decision to make.
    expect((sent[0]?.html.match(/<a /g) ?? []).length).toBe(1);
  });

  /*
   * `new_message` is the one event the ticket rules out by name: per-message
   * email is how a product teaches people to mute it.
   */
  it('sends nothing at all for a new message', async () => {
    const { deps: d, sent } = deps();

    await sendNotificationEmail(d, { ...ROW, type: 'new_message', title: 'New message' });

    expect(sent).toEqual([]);
  });

  it('always sends a plain-text alternative beside the html', async () => {
    const { deps: d, sent } = deps();

    await sendNotificationEmail(d, ROW);

    expect(sent[0]?.text).not.toContain('<');
    expect(sent[0]?.text.trim()).not.toBe('');
  });

  /*
   * A user removed between the event and the send has no inbox to reach. The
   * in-app row is already durable, so this is a skip rather than a failure.
   */
  it('skips a recipient that no longer exists rather than crashing', async () => {
    const {
      deps: d,
      sent,
      errors,
    } = deps({
      db: {
        select: () => ({
          from: () => ({ where: () => ({ limit: async () => [] }) }),
        }),
      } as unknown as NotificationEmailDeps['db'],
    });

    await expect(sendNotificationEmail(d, ROW)).resolves.toBeUndefined();
    expect(sent).toEqual([]);
    expect(errors).toEqual([]);
  });

  /*
   * The load-bearing one. A booking that succeeded must not appear to fail
   * because an email bounced — so this resolves, and the failure is visible in
   * the log rather than in the response.
   */
  it('never throws when the send fails, and logs it instead', async () => {
    const { deps: d, errors } = deps({
      email: {
        send: async () => {
          throw new Error('Resend refused the send (500)');
        },
      },
    });

    await expect(sendNotificationEmail(d, ROW)).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
    expect(errors[0]?.[1]).toContain('the operation itself succeeded');
  });

  /* A business name renders exactly as entered, and a note is not markup. */
  it('escapes user text rather than letting it become markup', async () => {
    const { deps: d, sent } = deps();

    await sendNotificationEmail(d, {
      ...ROW,
      title: 'Ash & Oak <script>',
      body: 'They said "yes"',
    });

    expect(sent[0]?.html).toContain('Ash &amp; Oak &lt;script&gt;');
    expect(sent[0]?.html).not.toContain('<script>');
    // The subject is a header, not markup — it carries the name as entered.
    expect(sent[0]?.subject).toBe('Ash & Oak <script>');
  });
});

describe('the email set matches the notification set', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/modules/notifications/notification-email.ts'),
    'utf8',
  );

  /*
   * The enum is the source of truth for what the product can emit, and this is
   * the thing that fails when somebody adds an event and forgets the inbox. It
   * asserts a *decision was made* per type, not that every type emails — the
   * decision for `new_message` is "no".
   */
  it('has a decision recorded for every notification type', () => {
    const undecided = NOTIFICATION_TYPES.filter(
      (type) => !source.includes(`${type}:`) && type !== 'new_message',
    );

    expect(undecided).toEqual([]);
    // And the one deliberate omission is still omitted.
    expect(source).not.toContain('new_message:');
  });
});

/*
 * The `apps/web` guard, ported — and **narrowed to what ships**.
 *
 * There was no equivalent for `apps/api`, which mattered the moment the API
 * grew templates: an email is archived in somebody's inbox, so a stale brand
 * name there outlives the one in the UI.
 *
 * The web version greps whole files. Run unchanged here it fails on four
 * legitimate hits — `stripe.ts` and `vendors.dao.ts` name the product while
 * *explaining* a Stripe account model, and that is prose doing its job. So this
 * blanks comments first and scans what is left, which is the rule the guard was
 * always reaching for: **no rendered string may spell the brand.**
 */
describe('brand literals', () => {
  const FORBIDDEN = ['Orla', 'VenMatch', 'VendorHub', 'venmatch', 'orla.com'];

  /** Source with comments blanked, positions preserved. */
  function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) =>
      comment.replace(/[^\n]/g, ' '),
    );
  }

  function sourceFiles(): [string, string][] {
    const root = join(process.cwd(), 'src');

    return readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((entry) => /\.ts$/.test(entry) && !/\.test\.ts$/.test(entry))
      .sort()
      .map((entry) => [join('src', entry), readFileSync(join(root, entry), 'utf8')]);
  }

  const EMAIL_SOURCE = 'src/modules/notifications/notification-email.ts';

  it('reads the tree it is scanning, so the check cannot be vacuous', () => {
    expect(sourceFiles().length).toBeGreaterThan(50);
  });

  it('proves it can fail, on a rendered string that spells the brand', () => {
    expect(withoutComments(`const subject = '${BRAND_NAME} says hello';`)).toContain(BRAND_NAME);
  });

  it('reads a brand name in a comment as prose rather than as a render', () => {
    expect(withoutComments(`/* ${BRAND_NAME} takes the payment. */`)).not.toContain(BRAND_NAME);
  });

  it.each(FORBIDDEN)('renders %s nowhere in apps/api/src', (literal) => {
    const offenders = sourceFiles()
      .filter(([, source]) => withoutComments(source).includes(literal))
      .map(([file]) => file);

    expect(offenders).toEqual([]);
  });

  it('reads the brand from the constant, so a rename reaches every template', () => {
    const source = readFileSync(join(process.cwd(), EMAIL_SOURCE), 'utf8');

    expect(withoutComments(source)).toContain('BRAND_NAME');
    expect(BRAND_NAME.length).toBeGreaterThan(0);
  });

  /*
   * `BRAND_DOMAIN` is the domain the product will live on, not the origin this
   * deployment answers on. Anything a machine follows — and every link in an
   * email is followed by a machine first — comes from `WEB_URL`.
   */
  it('never builds an emailed link from BRAND_DOMAIN', () => {
    const source = readFileSync(join(process.cwd(), EMAIL_SOURCE), 'utf8');

    expect(withoutComments(source)).not.toContain('BRAND_DOMAIN');
    expect(withoutComments(source)).toContain('webOrigin');
  });
});
