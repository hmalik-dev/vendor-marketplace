import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, MAX_PAGE } from '@vendor-marketplace/shared';
import { boundedText, oneOf, pageNumber } from './admin-params';

describe('oneOf', () => {
  it('returns the value when it is in the vocabulary', () => {
    expect(oneOf('review', ['live', 'review'] as const)).toBe('review');
  });

  it('drops anything the vocabulary does not contain', () => {
    // The class of defect: an unknown value forwarded to the API is a 400,
    // and a 400 the console does not handle is the 500 page.
    for (const hostile of ['REVIEW', 'live;drop', '', undefined, '__proto__']) {
      expect(oneOf(hostile, ['live', 'review'] as const), String(hostile)).toBeUndefined();
    }
  });
});

describe('boundedText', () => {
  it('trims and keeps a normal term', () => {
    expect(boundedText('  kessler ')).toBe('kessler');
  });

  it('drops an empty or whitespace-only term rather than sending `q=`', () => {
    expect(boundedText('   ')).toBeUndefined();
    expect(boundedText(undefined)).toBeUndefined();
  });

  it('truncates to the cap the API enforces', () => {
    const long = 'a'.repeat(MAX_NAME_LENGTH + 200);

    expect(boundedText(long)).toHaveLength(MAX_NAME_LENGTH);
  });
});

describe('pageNumber', () => {
  it('reads a real page', () => {
    expect(pageNumber('4')).toBe(4);
  });

  it('falls back to page 1 for every value the API would refuse', () => {
    for (const hostile of [
      '0',
      '-3',
      'abc',
      '1.5',
      '',
      undefined,
      String(MAX_PAGE + 1),
      '2147483648',
    ]) {
      expect(pageNumber(hostile), String(hostile)).toBe(1);
    }
  });

  it('accepts the ceiling itself', () => {
    expect(pageNumber(String(MAX_PAGE))).toBe(MAX_PAGE);
  });
});
