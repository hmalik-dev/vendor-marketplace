import {
  REPORT_REASON_LABELS,
  REPORT_SUBJECT_LABELS,
  SUPPORT_CASE_ORIGINS,
  SUPPORT_TOPIC_LABELS,
} from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { CASE_ARRIVAL, CASE_PRESENTATION, caseSubject } from './case-presentation';

/**
 * How the console words a case, once per door.
 *
 * Written when #436 added the third `origin`, because the two seams that
 * describe a case's provenance were both two-way branches on what had become a
 * three-member enum — and one of them shipped, telling an operator that an
 * in-product report "arrived by Contact support" on the screen where they weigh
 * how much the account of events is worth. A wrong sentence stated confidently
 * is the failure this file exists to make impossible to reintroduce.
 */
describe('case presentation', () => {
  it('names a door for every origin, and never the wrong one', () => {
    for (const origin of SUPPORT_CASE_ORIGINS) {
      expect(CASE_ARRIVAL[origin]).toBeTypeOf('string');
      expect(CASE_ARRIVAL[origin].length).toBeGreaterThan(0);
    }

    expect(CASE_ARRIVAL.support_message).toBe('Contact support');
    expect(CASE_ARRIVAL.chargeback).toBe('Stripe webhook');
    /* The one the shipped ternary got wrong by falling through its else. */
    expect(CASE_ARRIVAL.user_report).toBe('Reported in the product');
  });

  it('gives every origin a distinct arrival line', () => {
    const lines = SUPPORT_CASE_ORIGINS.map((origin) => CASE_ARRIVAL[origin]);

    expect(new Set(lines).size).toBe(SUPPORT_CASE_ORIGINS.length);
  });

  /*
   * A report's topic is `trust-and-safety` by construction, so printing it
   * would label every report identically. The reason and the subject are what
   * an operator triages on.
   */
  it('reads a report as its reason and its subject, not as its topic', () => {
    expect(
      caseSubject({
        origin: 'user_report',
        topic: 'trust-and-safety',
        subjectType: 'conversation',
        reportReason: 'off-platform-payment',
      }),
    ).toBe(
      `${REPORT_REASON_LABELS['off-platform-payment']} · ${REPORT_SUBJECT_LABELS.conversation}`,
    );

    expect(
      caseSubject({ origin: 'user_report', topic: 'trust-and-safety', subjectType: 'review' }),
    ).toBe(REPORT_SUBJECT_LABELS.review);
  });

  it('still reads a support message by its topic and a chargeback by its origin', () => {
    expect(caseSubject({ origin: 'support_message', topic: 'booking-or-payment' })).toBe(
      SUPPORT_TOPIC_LABELS['booking-or-payment'],
    );
    expect(caseSubject({ origin: 'chargeback', topic: null })).toBe('Chargeback');
  });

  it('never leaves a report with an empty subject line', () => {
    expect(caseSubject({ origin: 'user_report', topic: null })).toBe('Report');
  });

  it('colours an open case as waiting and a resolved one as settled', () => {
    expect(CASE_PRESENTATION.open).toEqual({ tone: 'pending', label: 'Open' });
    expect(CASE_PRESENTATION.resolved).toEqual({ tone: 'confirmed', label: 'Resolved' });
  });
});
