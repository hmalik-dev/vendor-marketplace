import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * VEN-721: a sentence about money, timing or cancellation reads its number from
 * the constant that decides it, or states no number.
 *
 * Every wrong sentence that ticket found had a typed figure or duration in it
 * ("stays held for you for 24 hours", "message you two weeks out", "about five
 * minutes"): a value written from the design or from memory, correct until the
 * day the constant moved and wrong from the start where no constant existed.
 * A figure read from a constant arrives as an interpolation (`${…}` or `{…}`),
 * which this scan replaces before it looks, so it is never mistaken for a typed
 * one — and a typed one cannot pass.
 *
 * The scan reads the real source of each file below, comments removed, and looks
 * only at the text a person reads: string literals and JSX text.
 */
const ROOT = resolve(import.meta.dirname, '../../..');

/**
 * The surfaces that state money, timing or cancellation to a customer or vendor.
 *
 * Not here on purpose: `support-email.ts` and `support-screen.tsx`, whose "usually
 * within one business day" is a staffing commitment no code decides, left as
 * written and filed on VEN-378 with the monitored support destination.
 */
const SCANNED_FILES = [
  'apps/web/src/components/checkout/checkout-screen.tsx',
  'apps/web/src/components/checkout/checkout-unavailable.tsx',
  'apps/web/src/components/checkout/refund-schedule-block.tsx',
  'apps/web/src/components/bookings/booking-confirmed.tsx',
  'apps/web/src/components/bookings/accepted-request.tsx',
  'apps/web/src/components/bookings/quote-review.tsx',
  'apps/web/src/components/bookings/report-problem.tsx',
  'apps/web/src/components/vendor/next-payout.tsx',
  'apps/web/src/components/vendor/cancel-booking.tsx',
  'apps/web/src/components/vendor/complete-booking.tsx',
  'apps/web/src/app/vendor/dashboard/page.tsx',
  'apps/web/src/app/vendor/payments/page.tsx',
  'apps/web/src/app/vendor/payments/return/page.tsx',
  'apps/web/src/components/admin/case-resolution.tsx',
  'apps/web/src/components/admin/payment-table.tsx',
  'apps/web/src/app/vendor/bookings/page.tsx',
  'apps/web/src/app/for-vendors/page.tsx',
  'apps/web/src/lib/refund-deadline.ts',
  'apps/api/src/modules/notifications/notify-user.ts',
  'apps/api/src/modules/booking-requests/booking-requests.service.ts',
  'apps/api/src/modules/payments/payments.service.ts',
  'packages/shared/src/constants/legal.ts',
] as const;

/** The nouns and verbs that make a sentence a statement about money. */
const MONEY_WORD =
  /\b(?:refund(?:s|ed|ing)?|pay|pays|paid|payment|payments|payout|payouts|charge|charged|held|hold|holds|cancel|cancels|cancelled|cancelling|cancellation|release|released|deposit|price)\b/i;

/** Any digit. In a sentence about money it is a typed figure. `{…}` and `${…}` are replaced first. */
const DIGIT = /\d/;

/**
 * A count of time, spelled out or in digits, in any sentence at all: "two weeks
 * out", "about five minutes", "a minute or two", "24 hours". Nothing decides how
 * long Stripe or a person takes, so a sentence that states it is unverifiable
 * whether or not it names money.
 */
const TYPED_DURATION =
  /\b(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fourteen|twenty|thirty|forty|sixty|seventy|hundred|half|few|couple)\s+(?:(?:business|calendar)\s+)?(?:hours?|days?|weeks?|minutes?|months?)\b/i;

const INTERPOLATION = '‹value›';

/**
 * The text a person can read in a source file: string literals (template
 * interpolations replaced) and JSX text (`{expression}` replaced). Comments are
 * dropped, and strings are blanked before JSX text is read so a `>` inside a
 * string is not mistaken for a tag.
 */
function readableUnits(source: string): string[] {
  const units: string[] = [];
  let code = '';
  let index = 0;

  while (index < source.length) {
    const char = source[index] as string;
    const next = source[index + 1];

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end === -1 ? source.length : end + 2;
      code += ' ';
    } else if (char === '/' && next === '/' && source[index - 1] !== '\\') {
      const end = source.indexOf('\n', index);
      index = end === -1 ? source.length : end;
    } else if (char === "'" || char === '"' || char === '`') {
      let text = '';
      index += 1;

      while (index < source.length && source[index] !== char) {
        if (source[index] === '\\') {
          text += source[index + 1] ?? '';
          index += 2;
        } else if (char === '`' && source[index] === '$' && source[index + 1] === '{') {
          let depth = 1;
          index += 2;
          while (index < source.length && depth > 0) {
            if (source[index] === '{') {
              depth += 1;
            } else if (source[index] === '}') {
              depth -= 1;
            }
            index += 1;
          }
          text += INTERPOLATION;
        } else {
          text += source[index];
          index += 1;
        }
      }

      index += 1;
      units.push(text);
      code += ' ';
    } else {
      code += char;
      index += 1;
    }
  }

  for (const match of code.matchAll(/>((?:[^<>{}]|\{[^{}]*\})+)</g)) {
    units.push((match[1] as string).replace(/\{[^{}]*\}/g, INTERPOLATION));
  }

  return units.map((unit) => unit.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Every readable sentence that talks about money and types a figure or a duration. */
function typedMoneyFigures(source: string): string[] {
  return readableUnits(source).filter(
    (unit) => (MONEY_WORD.test(unit) && DIGIT.test(unit)) || TYPED_DURATION.test(unit),
  );
}

function sourceOf(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

/** The source with a mutation inserted after its last `import`, in code rather than a comment. */
function withMutation(source: string, mutation: string): string {
  const lastImport = [...source.matchAll(/^import [\s\S]*?;$/gm)].at(-1);
  const at = lastImport ? lastImport.index + lastImport[0].length : 0;

  return `${source.slice(0, at)}\n${mutation}\n${source.slice(at)}`;
}

describe('a money sentence types no figure or duration', () => {
  it.each(SCANNED_FILES)('%s reads every figure from a constant', (path) => {
    expect(typedMoneyFigures(sourceOf(path))).toEqual([]);
  });

  /*
   * The guard's own proof, made on each real file: a typed figure inserted into
   * the real source is found, in a string and in JSX text. A scan that a comment
   * opener or an odd quote in the file could blind would pass the test above for
   * the wrong reason, and this is the test that would show it.
   */
  it.each(SCANNED_FILES)('%s: a typed figure inserted into it is found', (path) => {
    const source = sourceOf(path);

    expect(
      typedMoneyFigures(
        withMutation(source, "const mutated = 'Your payment is held for 24 hours.';"),
      ),
    ).toEqual(['Your payment is held for 24 hours.']);
    expect(
      typedMoneyFigures(
        withMutation(source, 'const mutated = <p>The refund lands in two weeks.</p>;'),
      ),
    ).toEqual(['The refund lands in two weeks.']);
  });

  it('reads a figure that arrives as an interpolation as a constant, not a typed value', () => {
    expect(typedMoneyFigures('const a = `Released ${PAYOUT_RELEASE_HOURS} hours after`;')).toEqual(
      [],
    );
    expect(typedMoneyFigures('const a = <p>Payment held {HOURS} hours after.</p>;')).toEqual([]);
  });

  it('finds the three claims this ticket removed, as they were written', () => {
    for (const written of [
      'stays held for you for 24 hours.',
      'message you two weeks out about payment',
      'You can not take payment until payouts are connected. It takes about five minutes.',
      'This usually takes a minute or two, and sometimes longer.',
      'They will message you two weeks out to plan the timeline.',
      'Check back in a few minutes.',
    ]) {
      expect(typedMoneyFigures(`const a = '${written}';`)).toEqual([written]);
    }
  });
});
