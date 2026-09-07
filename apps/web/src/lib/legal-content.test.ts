import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOOKING_REQUEST_EXPIRY_DAYS,
  BRAND_NAME,
  DEFAULT_PLATFORM_FEE_RATE,
  FULL_REFUND_CUTOFF_HOURS,
  LATE_CANCELLATION_REFUND_RATE,
  LEGAL_DOCUMENT_SLUGS,
  LEGAL_JUMP_RAIL_MIN_SECTIONS,
  LEGAL_PATHS,
  PAYOUT_RELEASE_HOURS,
  legalFactTokens,
} from '@vendor-marketplace/shared';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legalDocument, legalMarkdownSource } from './legal-content';
import { legalDocumentText, parseLegalMarkdown } from './legal-markdown';

describe('legal content', () => {
  /**
   * Per document, not one date for all three.
   *
   * The page says the date at its top is the date of the version you are
   * reading, so a document that changes moves its own date and the others do
   * not — which a single shared literal made impossible to express. #436's
   * message-access clause was the first edit to prove it.
   */
  it('loads all three documents with their own frontmatter date', () => {
    const dates: Record<(typeof LEGAL_DOCUMENT_SLUGS)[number], string> = {
      terms: '2026-06-04',
      privacy: '2026-09-07',
      cookies: '2026-06-04',
    };

    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      expect([slug, legalDocument(slug).lastUpdated]).toEqual([slug, dates[slug]]);
    }
  });

  /**
   * A claim about reading private messages must be on somebody's review list.
   *
   * #436 added the only paragraph in this corpus that asserts staff can read a
   * user's messages. Everything else here is placeholder nobody has relied on;
   * that sentence is not, and the ticket's own acceptance asks for it to be
   * marked as unreviewed rather than shipped as though a lawyer had written it.
   * `docs/pre-launch.md` is the register #374 established for exactly that.
   *
   * A test rather than a paragraph asking a future reader to remember, because
   * the failure mode is silent in both directions: delete the register line and
   * the claim ships unreviewed, reword the claim and the register stops
   * describing it. This fails if the clause exists without an entry naming it.
   */
  it('keeps the staff-message-access clause on the pre-launch review register', () => {
    const privacy = legalMarkdownSource('privacy');
    const claimsStaffCanRead = /the people who operate the platform can read it/.test(privacy);

    expect(claimsStaffCanRead).toBe(true);

    const register = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/pre-launch.md'),
      'utf8',
    );

    expect(register).toContain('staff-message-access clause');
    expect(register).toContain('#436');
  });

  it('titles each page from its frontmatter', () => {
    expect(LEGAL_DOCUMENT_SLUGS.map((slug) => legalDocument(slug).title)).toEqual([
      'Terms of Service',
      'Privacy Policy',
      'Cookie notice',
    ]);
  });

  /** Acceptance 3: the anchors are public URLs, so they are pinned by name. */
  it('gives every heading a stable slug derived from its text', () => {
    const terms = legalDocument('terms');

    expect(terms.sections.map((section) => section.id)).toEqual([
      'who-we-are',
      'what-orla-does',
      'your-account',
      'bookings-and-payment',
      'cancellations-and-refunds',
      'if-you-are-a-vendor',
      'reviews',
      'files-you-upload',
      'liability',
      'changes-to-these-terms',
      'contact',
    ]);
  });

  it('numbers the terms sections from one to eleven', () => {
    expect(legalDocument('terms').sections.map((section) => section.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  /** Acceptance 2: the rail's own condition, checked on the content itself. */
  it('gives terms and privacy enough sections for the rail, and cookies none', () => {
    expect(legalDocument('terms').sections.length).toBeGreaterThanOrEqual(
      LEGAL_JUMP_RAIL_MIN_SECTIONS,
    );
    expect(legalDocument('privacy').sections.length).toBeGreaterThanOrEqual(
      LEGAL_JUMP_RAIL_MIN_SECTIONS,
    );
    expect(legalDocument('cookies').sections.length).toBeLessThan(LEGAL_JUMP_RAIL_MIN_SECTIONS);
  });

  it('carries the hold-and-release mechanism in an emphasis panel in section 4', () => {
    const section = legalDocument('terms').sections[3];
    const panel = section.blocks.find((block) => block.kind === 'panel');

    expect(section.title).toBe('Bookings and payment');
    expect(panel).toBeDefined();
  });

  it('draws the privacy data map as a table over the real stack', () => {
    const table = legalDocument('privacy')
      .sections.flatMap((section) => section.blocks)
      .find((block) => block.kind === 'table');

    expect(table?.header).toEqual(['What', 'Held by', 'Why']);
    expect(table?.rows.map((row) => row[1].map((span) => span.text).join(''))).toEqual([
      'Stripe',
      'Clerk',
      'Cloudflare R2',
      BRAND_NAME,
      'Stripe',
    ]);
  });

  it('ends the privacy page on a sage note', () => {
    const blocks = legalDocument('privacy').sections.at(-1)?.blocks ?? [];

    expect(blocks.at(-1)?.kind).toBe('note');
  });

  it('names only the Clerk session cookie on the cookie notice', () => {
    const table = legalDocument('cookies').lead.find((block) => block.kind === 'table');

    expect(table?.rows).toHaveLength(1);
    expect(table?.rows[0].map((cell) => cell.map((span) => span.text).join(''))).toEqual([
      '__session',
      'Clerk',
      'Strictly necessary — your sign-in.',
    ]);
  });
});

/**
 * Acceptance 5. #428 built the footer's legal row and shipped it pointing at
 * three destinations that did not exist, so every page in the product carried
 * three 404s. What this ticket adds is the pages behind it — and the assertion
 * to write is therefore that each link **resolves**, not that the row is there.
 */
describe('every footer legal link has a page behind it', () => {
  it('has a page file for each path the footer links to', () => {
    const missing = LEGAL_DOCUMENT_SLUGS.filter(
      (slug) =>
        !existsSync(join(process.cwd(), 'src', 'app', LEGAL_PATHS[slug].slice(1), 'page.tsx')),
    );

    expect(missing).toEqual([]);
  });

  it('keeps the three paths the footer and Stripe Connect both name', () => {
    expect(LEGAL_DOCUMENT_SLUGS.map((slug) => LEGAL_PATHS[slug])).toEqual([
      '/terms',
      '/privacy',
      '/cookies',
    ]);
  });
});

describe('the facts in the copy', () => {
  /**
   * Acceptance 14. Asserted by searching the rendered copy, because the whole
   * risk is a sentence somebody wrote in good faith describing a tier the code
   * does not have — #374's dispute the platform loses.
   */
  it('states no non-refundable window anywhere, because none exists', () => {
    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      const text = legalDocumentText(legalDocument(slug)).toLowerCase();

      expect([slug, text.includes('non-refundable')]).toEqual([slug, false]);
      expect([slug, text.includes('nonrefundable')]).toEqual([slug, false]);
    }
  });

  /**
   * The privacy page has to describe **this** codebase, not a tidier one.
   *
   * `legal_acceptances` stores the caller's IP address and browser string, and
   * the immutability trigger means neither can later be edited or removed while
   * the vendor exists. A page that lists what is collected, closes the list
   * with "nothing else", and offers unconditional deletion would be false about
   * our own processing — which is exactly the class of untruth the fact-token
   * machinery exists to prevent everywhere else on these pages.
   */
  it('names the acceptance record among what is collected', () => {
    const text = legalDocumentText(legalDocument('privacy'));

    expect(text).toContain('IP address');
    expect(text).toContain('browser that sent it');
  });

  it('does not promise an erasure the database refuses', () => {
    const rights = legalDocument('privacy').sections.find(
      (section) => section.title === 'Your rights',
    );
    const text = (rights?.blocks ?? [])
      .flatMap((block) => (block.kind === 'paragraph' ? block.spans : []))
      .map((span) => span.text)
      .join('');

    expect(text).toContain('not editable and not removable');
  });

  /** Ruled and cut: nothing in this product describes an enforcement process. */
  it('makes no threat it cannot execute about repeated cancellations', () => {
    const text = legalDocumentText(legalDocument('terms')).toLowerCase();

    expect(text).not.toContain('end your listing');
  });

  it('never says the vendor is paid at checkout', () => {
    const section = legalDocument('terms').sections[3];
    const text = section.blocks
      .flatMap((block) =>
        block.kind === 'panel' || block.kind === 'note'
          ? block.paragraphs.flat()
          : block.kind === 'paragraph'
            ? block.spans
            : [],
      )
      .map((span) => span.text)
      .join('');

    expect(text).toContain(`held by ${BRAND_NAME}`);
    expect(text).toContain('after the event date');
  });

  /**
   * Acceptance 15, first half: the numbers are not in the prose at all.
   *
   * Read off the markdown source rather than the rendered document, because
   * this is a claim about what was written — a page can only follow a constant
   * if the digits were never typed beside the sentence in the first place.
   */
  it('types no fact digit into the markdown', () => {
    const forbidden = [
      String(Math.round(DEFAULT_PLATFORM_FEE_RATE * 100)),
      String(FULL_REFUND_CUTOFF_HOURS),
      String(Math.round(LATE_CANCELLATION_REFUND_RATE * 100)),
      String(PAYOUT_RELEASE_HOURS),
      String(BOOKING_REQUEST_EXPIRY_DAYS),
    ];

    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      /* The frontmatter's date is a date, not a fact about money. */
      const body = legalMarkdownSource(slug).replace(/^---\n[\s\S]*?\n---\n/, '');

      for (const digits of forbidden) {
        expect([slug, digits, new RegExp(`\\b${digits}\\b`).test(body)]).toEqual([
          slug,
          digits,
          false,
        ]);
      }
    }
  });

  /**
   * Acceptance 15, second half, and the only form of it that proves anything:
   * move the constant, re-render, and watch the page move with it.
   */
  it('follows a constant that moves', () => {
    const source = legalMarkdownSource('terms');
    const before = legalDocumentText(parseLegalMarkdown('terms', source));
    const after = legalDocumentText(
      parseLegalMarkdown('terms', source, { ...legalFactTokens(), commission: '19%' }),
    );

    expect(before).toContain('12% commission');
    expect(before).not.toContain('19%');
    expect(after).toContain('19% commission');
    expect(after).not.toContain('12%');
  });

  it('resolves every fact from the constant that decides it', () => {
    expect(legalFactTokens()).toEqual({
      brand: BRAND_NAME,
      commission: '12%',
      fullRefundCutoffHours: '48 hours',
      lateRefundShare: '50%',
      payoutReleaseHours: '72 hours',
      requestExpiryDays: '7 days',
    });
  });
});
