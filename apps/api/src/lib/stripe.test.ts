import { describe, expect, it } from 'vitest';
import { describeAccountEvent, isMissingPayoutsOnly, isOnboarded } from './stripe.js';

describe('isOnboarded', () => {
  /*
   * `stripe_onboarded` is one column standing for two Stripe capabilities. A
   * vendor who can receive a transfer but cannot be paid out has money arriving
   * in a balance they cannot empty, which is worse than being told they are not
   * set up yet — so this is an AND, and these four cases are the whole of it.
   */
  it('requires both capabilities, not either', () => {
    expect(isOnboarded({ transfersActive: true, payoutsActive: true })).toBe(true);
    expect(isOnboarded({ transfersActive: true, payoutsActive: false })).toBe(false);
    expect(isOnboarded({ transfersActive: false, payoutsActive: true })).toBe(false);
    expect(isOnboarded({ transfersActive: false, payoutsActive: false })).toBe(false);
  });
});

describe('isMissingPayoutsOnly', () => {
  /*
   * Both capabilities are granted together, and only `external_account`
   * restricts payouts on its own — so this state means exactly "identity done,
   * no bank account", and nothing else does.
   */
  it('names only the identity-done, no-bank-account state', () => {
    expect(isMissingPayoutsOnly({ transfersActive: true, payoutsActive: false })).toBe(true);
    expect(isMissingPayoutsOnly({ transfersActive: true, payoutsActive: true })).toBe(false);
    expect(isMissingPayoutsOnly({ transfersActive: false, payoutsActive: false })).toBe(false);
    // Not reachable through onboarding, and deliberately not claimed as this state.
    expect(isMissingPayoutsOnly({ transfersActive: false, payoutsActive: true })).toBe(false);
  });
});

describe('describeAccountEvent', () => {
  /*
   * The shape that actually arrives today. A v2 account still emits the v1
   * snapshot Connect events, and thin `v2.core.*` delivery needs an event
   * destination provisioned before it produces anything — so a handler that
   * reads only the v2 shape is a webhook that never fires, and a vendor who
   * never leaves the payout gate. Probed against this platform's test account:
   * one onboarding attempt produced three v1 events and no thin ones.
   */
  it('reads the connected account off a v1 snapshot Connect event', () => {
    expect(
      describeAccountEvent({
        object: 'event',
        type: 'account.updated',
        account: 'acct_live_one',
        data: { object: { id: 'acct_live_one' } },
      }),
    ).toEqual({ type: 'account.updated', accountId: 'acct_live_one' });
  });

  /** `capability.updated` carries a Capability in `data`, so `account` is the only source. */
  it('reads it off a capability event, whose payload object is not the account', () => {
    expect(
      describeAccountEvent({
        object: 'event',
        type: 'capability.updated',
        account: 'acct_live_two',
        data: { object: { id: 'transfers' } },
      }),
    ).toEqual({ type: 'capability.updated', accountId: 'acct_live_two' });
  });

  it('reads it off a v2 thin notification', () => {
    expect(
      describeAccountEvent({
        object: 'v2.core.event',
        type: 'v2.core.account[configuration.recipient].capability_status_updated',
        related_object: { id: 'acct_thin', type: 'v2.core.account' },
      }),
    ).toEqual({
      type: 'v2.core.account[configuration.recipient].capability_status_updated',
      accountId: 'acct_thin',
    });
  });

  it('falls back to the payload object when there is no separate account field', () => {
    expect(
      describeAccountEvent({
        object: 'event',
        type: 'account.updated',
        data: { object: { id: 'acct_from_data' } },
      }),
    ).toEqual({ type: 'account.updated', accountId: 'acct_from_data' });
  });

  it('names no account for an event that is about something else', () => {
    expect(
      describeAccountEvent({ object: 'event', type: 'charge.succeeded', data: { object: {} } }),
    ).toEqual({ type: 'charge.succeeded', accountId: null });
  });

  it('survives a body with nothing in it rather than throwing', () => {
    expect(describeAccountEvent(null)).toEqual({ type: '', accountId: null });
    expect(describeAccountEvent({})).toEqual({ type: '', accountId: null });
  });
});
