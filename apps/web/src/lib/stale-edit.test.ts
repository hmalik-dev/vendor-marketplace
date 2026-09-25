import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiClientError } from '@/lib/api-client';
import { STALE_EDIT_NOTICE, currentFromStaleEdit } from '@/lib/stale-edit';

const schema = z.object({ name: z.string() });

describe('currentFromStaleEdit', () => {
  it('returns the current row from a 409 that carries one', () => {
    const error = new ApiClientError(409, 'CONFLICT', 'changed', { current: { name: 'Now' } });

    expect(currentFromStaleEdit(error, schema)).toEqual({ name: 'Now' });
  });

  it('is null for a 409 with no current row', () => {
    expect(currentFromStaleEdit(new ApiClientError(409, 'CONFLICT', 'taken'), schema)).toBeNull();
  });

  it('is null for a current row that does not parse', () => {
    const error = new ApiClientError(409, 'CONFLICT', 'x', { current: { name: 5 } });

    expect(currentFromStaleEdit(error, schema)).toBeNull();
  });

  it('is null for any other status, and for a non-API error', () => {
    const notFound = new ApiClientError(404, 'NOT_FOUND', 'x', { current: { name: 'Now' } });

    expect(currentFromStaleEdit(notFound, schema)).toBeNull();
    expect(currentFromStaleEdit(new Error('offline'), schema)).toBeNull();
  });
});

describe('STALE_EDIT_NOTICE', () => {
  it('says what happened, then what to do', () => {
    expect(STALE_EDIT_NOTICE).toBe(
      'This changed since you opened it. Save again to replace it with your edits.',
    );
  });
});
