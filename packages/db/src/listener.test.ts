import { describe, expect, it } from 'vitest';
import { directConnectionString } from './listener.js';

describe('directConnectionString', () => {
  it('drops the pooler suffix from a Neon pooled host, and keeps everything else', () => {
    expect(
      directConnectionString(
        'postgresql://app:secret@ep-cool-lake-a1b2c3-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
      ),
    ).toBe(
      'postgresql://app:secret@ep-cool-lake-a1b2c3.us-east-2.aws.neon.tech/neondb?sslmode=require',
    );
  });

  it('leaves a direct host alone', () => {
    expect(
      directConnectionString('postgresql://app:secret@localhost:5432/vendor_marketplace'),
    ).toBe('postgresql://app:secret@localhost:5432/vendor_marketplace');
    expect(
      directConnectionString(
        'postgresql://app:secret@ep-cool-lake-a1b2c3.us-east-2.aws.neon.tech/db',
      ),
    ).toBe('postgresql://app:secret@ep-cool-lake-a1b2c3.us-east-2.aws.neon.tech/db');
  });

  it('only reads the suffix on the first label', () => {
    expect(directConnectionString('postgresql://app:secret@db.example-pooler.test/x')).toBe(
      'postgresql://app:secret@db.example-pooler.test/x',
    );
  });
});
