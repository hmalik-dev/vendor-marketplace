import { describe, expect, it, vi } from 'vitest';
import type { AppDatabase } from '../../lib/database.js';
import type { EmailMessage } from '../../lib/email.js';
import { EmailSendingClosedError } from '../../lib/email-send-cap.js';
import { alertNow, refundFailedAlert, type OperatorAlertDeps } from './operator-alerts.service.js';

/** A database whose every write throws — the outage these alerts exist for. */
const brokenDb = {
  transaction: async () => {
    throw new Error('connection refused');
  },
  delete: () => {
    throw new Error('connection refused');
  },
} as unknown as AppDatabase;

function deps(email?: OperatorAlertDeps['email']) {
  const sent: (EmailMessage & { idempotencyKey?: string })[] = [];
  const log = { error: vi.fn(), warn: vi.fn() };
  const all: OperatorAlertDeps = {
    db: brokenDb,
    email:
      email ??
      ({
        send: async (message: EmailMessage & { idempotencyKey?: string }) => {
          sent.push(message);
          return { providerMessageId: null };
        },
      } as OperatorAlertDeps['email']),
    log: log as unknown as OperatorAlertDeps['log'],
    background: { run: vi.fn() } as unknown as OperatorAlertDeps['background'],
    clock: () => new Date('2026-09-19T12:00:00Z'),
    to: 'ops@example.com',
    webOrigin: 'https://orla.test',
    wait: async () => undefined,
  };

  return { all, sent, log };
}

describe('alertNow', () => {
  it('still sends the email when the dedupe row cannot be written', async () => {
    const { all, sent, log } = deps();

    const result = await alertNow(all, refundFailedAlert({ bookingId: 'b1', during: 'a test' }));

    expect(result).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe('ops@example.com');
    expect(sent[0]!.subject).toBe('[Orla ops] Refund failed on booking b1');
    expect(sent[0]!.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    // Operator mail may spend the headroom past the daily cap (VEN-661).
    expect(sent[0]!.essential).toBe(true);
    expect(log.error).toHaveBeenCalledTimes(1);
  });

  it('sends an unrecorded alert once per subject per window, so an outage cannot mailbomb', async () => {
    const { all, sent } = deps();
    const alert = refundFailedAlert({ bookingId: 'b-flood', during: 'a test' });

    expect(await alertNow(all, alert)).toBe('sent');
    expect(await alertNow(all, alert)).toBe('deduplicated');
    expect(sent).toHaveLength(1);
  });

  it('does not let "the refund failed" silence "the refund went out and the row did not move" (VEN-472)', async () => {
    const { all, sent } = deps();

    expect(await alertNow(all, refundFailedAlert({ bookingId: 'b-two', during: 'a test' }))).toBe(
      'sent',
    );
    expect(
      await alertNow(
        all,
        refundFailedAlert({ bookingId: 'b-two', during: 'a test', refundId: 're_1' }),
      ),
    ).toBe('sent');
    expect(sent).toHaveLength(2);
    expect(sent[1]!.text).toContain('re_1');
  });

  it('reports failed, and skips releasing a row it never wrote, when the unrecorded send also fails', async () => {
    const { all, log } = deps({
      send: async () => {
        throw new Error('resend down');
      },
    } as unknown as OperatorAlertDeps['email']);

    const result = await alertNow(all, refundFailedAlert({ bookingId: 'b2', during: 'a test' }));

    expect(result).toBe('failed');
    // One for the record, one for the exhausted send; no release was attempted.
    expect(log.error).toHaveBeenCalledTimes(2);
  });

  it('stops retrying at once when the day is closed, rather than waiting to be refused again (VEN-661)', async () => {
    let attempts = 0;
    const { all } = deps({
      send: async () => {
        attempts += 1;
        throw new EmailSendingClosedError('quota', '2026-09-19');
      },
    } as unknown as OperatorAlertDeps['email']);
    const wait = vi.fn(async () => undefined);

    const result = await alertNow(
      { ...all, wait },
      refundFailedAlert({ bookingId: 'b-closed', during: 'a test' }),
    );

    expect(result).toBe('failed');
    expect(wait).not.toHaveBeenCalled();
    // The first try and the final one; the two waited retries are skipped.
    expect(attempts).toBe(2);
  });
});
