import { describe, expect, it } from 'vitest';
import { invalidTransition } from './booking-requests.service.js';

describe('invalidTransition', () => {
  it('reads as a sentence whatever the status starts with', () => {
    const accepted = invalidTransition('accepted', 'declined');
    const expired = invalidTransition('expired', 'accepted');

    expect(accepted.statusCode).toBe(409);
    expect(accepted.message).toBe("This request is already accepted, so it can't be declined.");
    expect(expired.message).toBe("This request is already expired, so it can't be accepted.");
    expect(accepted.message).not.toMatch(/^A [ae]/);
  });
});
