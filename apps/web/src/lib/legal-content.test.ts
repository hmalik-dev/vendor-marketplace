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
  adminUserExportSchema,
  legalFactTokens,
} from '@vendor-marketplace/shared';
import { legalDocument, legalMarkdownSource } from './legal-content';
import { legalDocumentText, parseLegalMarkdown } from './legal-markdown';

describe('legal content', () => {
  it('loads all three documents with a frontmatter date', () => {
    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      expect([slug, legalDocument(slug).lastUpdated]).toEqual([slug, '2026-06-04']);
    }
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

  /**
   * #438's acceptance 8, against the **rendered** document rather than the
   * Markdown source.
   *
   * The policy made two promises the product could not keep — a copy of what we
   * hold, and closure on request — and both are now routes in the operations
   * console. These assertions are what stops the document and the product
   * drifting apart again in either direction: a category the page promises has
   * to be a key the export actually produces, and a refusal the API makes has
   * to be a refusal the page warns about.
   */
  describe("the privacy policy's data-rights promises (#438)", () => {
    function rightsText(): string {
      const rights = legalDocument('privacy').sections.find(
        (section) => section.title === 'Your rights',
      );

      return (rights?.blocks ?? [])
        .flatMap((block) => (block.kind === 'paragraph' ? block.spans : []))
        .map((span) => span.text)
        .join('');
    }

    /**
     * Each phrase the page promises, paired with the key of the export that
     * keeps it. A promise with no key behind it is a claim the product cannot
     * answer; a phrase that has left the page is a promise silently withdrawn.
     */
    const PROMISED_CATEGORIES = {
      'your bookings': 'bookings',
      'the requests behind them': 'bookingRequests',
      'the messages in your threads': 'messages',
      'the reviews you wrote': 'reviewsWritten',
      'the ones written about you': 'reviewsReceived',
      'your notifications': 'notifications',
      'your legal acceptances': 'legalAcceptances',
    } as const;

    it('promises no category the export cannot produce', () => {
      const text = rightsText();

      for (const [phrase, key] of Object.entries(PROMISED_CATEGORIES)) {
        expect([phrase, text.includes(phrase)]).toEqual([phrase, true]);
        expect(Object.keys(adminUserExportSchema.shape)).toContain(key);
      }
    });

    it('says the counterparty details are withheld, which the export declares', () => {
      expect(rightsText()).toContain(
        "The other party's email address and phone number are left out",
      );
      expect(Object.keys(adminUserExportSchema.shape)).toContain('withheld');
    });

    /**
     * D39. The page used to say *"what closing does remove is everything
     * else"*, which was untrue in both directions: closure is refused outright
     * while an upcoming confirmed booking stands, and what it does then is
     * retire the account rather than erase the record.
     */
    it('warns that closure is refused while an upcoming confirmed booking stands', () => {
      const text = rightsText();

      expect(text).toContain('Closing is refused while you hold an upcoming confirmed booking');
      expect(text).toContain('closing an account prices nothing and refunds nothing');
      expect(text).toContain('retires your account');
    });

    it('no longer claims closure removes everything else', () => {
      expect(rightsText()).not.toContain('What closing does remove is everything else');
    });
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
