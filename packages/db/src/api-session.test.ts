import { describe, expect, it } from 'vitest';
import {
  API_CONNECT_TIMEOUT_SECONDS,
  API_SESSION_SETTINGS,
  isDatabaseTimeout,
} from './api-session.js';
import { MIGRATION_SESSION_SETTINGS } from './migration-session.js';

const wrapped = (code: string): Error =>
  new Error('Failed query: select ...', { cause: Object.assign(new Error('driver'), { code }) });

describe('the API session', () => {
  it('bounds a statement, a lock wait and an idle transaction, and the connect', () => {
    expect(API_SESSION_SETTINGS).toEqual({
      statement_timeout: '10s',
      lock_timeout: '5s',
      idle_in_transaction_session_timeout: '120s',
    });
    expect(API_CONNECT_TIMEOUT_SECONDS).toBe(10);
  });

  it('leaves the migrator its own longer statement bound', () => {
    expect(MIGRATION_SESSION_SETTINGS.statement_timeout).toBe('60s');
    expect(MIGRATION_SESSION_SETTINGS).not.toHaveProperty('idle_in_transaction_session_timeout');
  });

  it('recognises a statement and a lock timeout, wrapped or bare, and nothing else', () => {
    expect(isDatabaseTimeout(wrapped('57014'))).toBe(true);
    expect(isDatabaseTimeout(wrapped('55P03'))).toBe(true);
    expect(isDatabaseTimeout(Object.assign(new Error('x'), { code: '57014' }))).toBe(true);
    expect(isDatabaseTimeout(wrapped('23505'))).toBe(false);
    expect(isDatabaseTimeout(new Error('57014'))).toBe(false);
    expect(isDatabaseTimeout(null)).toBe(false);
  });
});
