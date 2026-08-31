import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_NAME, NOTIFICATION_TYPES } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import type { EmailMessage } from '../../lib/email.js';
import {
  sendNotificationEmail,
  type NotificationEmailDeps,
  type NotificationEmailRow,
} from './notification-email.js';

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

/*
 * `data` carries the booking id because `notificationHref` reads the payload to
 * decide where the one action points — which is the whole reason the email
 * takes the row rather than a hand-built message.
 */
const ROW: NotificationEmailRow = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  type: 'booking_confirmed',
  title: 'June 14 is confirmed',
  body: 'Payment is held until the event is complete.',
  data: { bookingId: '33333333-3333-4333-8333-333333333333' },
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

  /*
   * The tap target, pinned as arithmetic rather than as a class string.
   *
   * A browser pass measured this button at **39px** — `padding:11px 18px` plus
   * a 17px default line box — against `04-laws.md`'s 44px minimum for anything
   * a finger taps. The three numbers that decide the height are asserted
   * together because changing any one of them silently changes it, and an email
   * is read on a phone more often than not.
   */
  it('draws the action at the 44px tap minimum', async () => {
    const { deps: d, sent } = deps();

    await sendNotificationEmail(d, ROW);

    const html = sent[0]?.html ?? '';
    const padding = /padding:(\d+)px \d+px/.exec(html)?.[1];
    const lineHeight = /line-height:(\d+)px/.exec(html)?.[1];

    expect(padding).toBeDefined();
    expect(lineHeight).toBeDefined();
    expect(Number(padding) * 2 + Number(lineHeight)).toBeGreaterThanOrEqual(44);
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

  /**
   * Source with comments blanked, positions preserved — **and string literals
   * left alone.**
   *
   * The obvious regex is wrong in the one way that matters here. `//` inside a
   * string starts a "comment" that runs to end of line, so
   * `const HOME = 'https://orla.com/welcome'` blanks to `const HOME = 'https:`
   * and the guard reads clean. `orla.com` is on the forbidden list and a URL is
   * the only shape it can take, so the naive version was blind to exactly the
   * literal it most needed to catch.
   *
   * A character walk rather than a cleverer regex: quoting and commenting are
   * not a regular language, and the failure mode of getting it subtly wrong is
   * a guard that passes.
   */
  function withoutComments(source: string): string {
    let out = '';
    let quote: string | null = null;
    let index = 0;

    while (index < source.length) {
      const char = source[index] as string;
      const next = source[index + 1];

      if (quote) {
        if (char === '\\') {
          out += source.slice(index, index + 2);
          index += 2;
          continue;
        }
        if (char === quote) {
          quote = null;
        }
        out += char;
        index += 1;
        continue;
      }

      if (char === "'" || char === '"' || char === '`') {
        quote = char;
        out += char;
        index += 1;
        continue;
      }

      if (char === '/' && next === '/') {
        while (index < source.length && source[index] !== '\n') {
          out += ' ';
          index += 1;
        }
        continue;
      }

      if (char === '/' && next === '*') {
        const close = source.indexOf('*/', index + 2);
        const stop = close === -1 ? source.length : close + 2;
        out += source.slice(index, stop).replace(/[^\n]/g, ' ');
        index = stop;
        continue;
      }

      out += char;
      index += 1;
    }

    return out;
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

  /*
   * The case the naive regex missed, asserted directly. A URL is the only shape
   * `orla.com` can take, and `//` inside it looked like the start of a comment.
   */
  it('does not mistake a URL’s slashes for the start of a comment', () => {
    const line = "const HOME = 'https://" + 'orla.com' + "/welcome';";

    expect(withoutComments(line)).toContain('orla.com');
  });

  it('still blanks a real line comment that follows a string', () => {
    const line = "const x = 'safe'; // " + BRAND_NAME;

    expect(withoutComments(line)).not.toContain(BRAND_NAME);
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
