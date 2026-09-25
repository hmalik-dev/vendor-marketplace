import { describe, expect, it } from 'vitest';
import { supportMessageSchema } from '../schemas/index.js';
import { SUPPORT_TOPIC_LABELS, SUPPORT_TOPICS } from './support.js';

describe('support topics', () => {
  it('lists the feature request immediately before something else', () => {
    const index = SUPPORT_TOPICS.indexOf('feature-request');

    expect(index).toBeGreaterThan(-1);
    expect(SUPPORT_TOPICS[index + 1]).toBe('something-else');
    expect(SUPPORT_TOPICS).toHaveLength(6);
  });

  it('labels the feature request', () => {
    expect(SUPPORT_TOPIC_LABELS['feature-request']).toBe('A feature request');
  });

  it('accepts the feature request topic and still rejects an unknown one', () => {
    const base = { email: 'visitor@example.com', message: 'Let me pin a vendor.' };

    expect(supportMessageSchema.safeParse({ ...base, topic: 'feature-request' }).success).toBe(
      true,
    );
    expect(supportMessageSchema.safeParse({ ...base, topic: 'nonsense' }).success).toBe(false);
  });
});
