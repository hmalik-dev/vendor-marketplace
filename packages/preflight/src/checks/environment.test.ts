import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findVariable } from '@vendor-marketplace/shared/env';
import { describe, expect, it } from 'vitest';
import { loadContext } from '../context.js';
import type { CheckContext, Target } from '../types.js';
import { environmentCheck, evaluateVariable } from './environment.js';

function contextWith(env: NodeJS.ProcessEnv, target: Target = 'local'): CheckContext {
  return {
    repoRoot: '/repo',
    env,
    envFileFound: true,
    capabilities: new Set(['core', 'auth', 'storage', 'stripe', 'email', 'sentry', 'e2e']),
    target,
  };
}

const STRIPE_KEY = findVariable('STRIPE_SECRET_KEY')!;
const API_URL = findVariable('API_URL')!;
const EMAIL_FROM = findVariable('EMAIL_FROM')!;

describe('evaluateVariable', () => {
  it('accepts a real value', () => {
    const result = evaluateVariable(
      STRIPE_KEY,
      contextWith({ STRIPE_SECRET_KEY: 'sk_test_51ABCdefGHIjklMNO' }),
    );

    expect(result.ok).toBe(true);
  });

  it('never echoes the value it just validated', () => {
    const secret = 'sk_test_51ABCdefGHIjklMNO';
    const result = evaluateVariable(STRIPE_KEY, contextWith({ STRIPE_SECRET_KEY: secret }));

    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it('reports a value still left as its placeholder', () => {
    const result = evaluateVariable(STRIPE_KEY, contextWith({ STRIPE_SECRET_KEY: 'sk_test_...' }));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('placeholder');
    expect(result.fix).toContain('https://dashboard.stripe.com/test/apikeys');
  });

  it('reports a value that fails its shape', () => {
    const result = evaluateVariable(STRIPE_KEY, contextWith({ STRIPE_SECRET_KEY: 'nonsense' }));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('shape');
  });

  it('treats an empty string as absent', () => {
    const result = evaluateVariable(STRIPE_KEY, contextWith({ STRIPE_SECRET_KEY: '' }));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('not set');
  });

  it('passes a defaulted value that is simply absent', () => {
    const result = evaluateVariable(API_URL, contextWith({}));

    expect(result.ok).toBe(true);
    expect(result.detail).toContain('defaults to http://localhost:4000');
  });

  it('requires a per-environment value to be explicit in production', () => {
    const result = evaluateVariable(API_URL, contextWith({}, 'production'));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('not set in .env.production.local');
  });

  it('rejects a production value left at the local default', () => {
    const result = evaluateVariable(
      API_URL,
      contextWith({ API_URL: 'http://localhost:4000' }, 'production'),
    );

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('still the local default');
  });

  it('accepts a real production value', () => {
    const result = evaluateVariable(
      API_URL,
      contextWith({ API_URL: 'https://api.orla.app' }, 'production'),
    );

    expect(result.ok).toBe(true);
  });

  it('rejects a test Stripe key against a production value set', () => {
    // The case the ticket calls out: the same registry, a stricter target.
    const result = evaluateVariable(
      STRIPE_KEY,
      contextWith({ STRIPE_SECRET_KEY: 'sk_test_51ABCdefGHIjklMNO' }, 'production'),
    );

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('production shape');
  });

  it('still checks presence for a free-form value with no shape', () => {
    expect(EMAIL_FROM.shape).toBeUndefined();
    expect(evaluateVariable(EMAIL_FROM, contextWith({})).ok).toBe(true);
    expect(evaluateVariable(EMAIL_FROM, contextWith({ EMAIL_FROM: '' })).ok).toBe(true);
  });

  it('tells the operator to create .env when there is no file at all', () => {
    const result = evaluateVariable(STRIPE_KEY, {
      ...contextWith({}),
      envFileFound: false,
    });

    expect(result.fix).toContain('cp .env.example .env');
  });
});

describe('environmentCheck', () => {
  it('reports every failure in one run rather than stopping at the first', async () => {
    const results = await environmentCheck.run(
      contextWith({ STRIPE_SECRET_KEY: 'sk_test_...', STRIPE_WEBHOOK_SECRET: 'whsec_...' }),
    );
    const failures = results.filter((result) => !result.ok).map((result) => result.name);

    expect(failures).toContain('STRIPE_SECRET_KEY');
    expect(failures).toContain('STRIPE_WEBHOOK_SECRET');
    expect(failures).toContain('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  });

  it('checks nothing for a capability that was not requested', async () => {
    const results = await environmentCheck.run({
      ...contextWith({}),
      capabilities: new Set(['core']),
    });

    expect(results.map((result) => result.name)).not.toContain('STRIPE_SECRET_KEY');
  });
});

describe('loadContext', () => {
  it('lets a real process variable win over the file, as the apps do', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'preflight-'));
    writeFileSync(path.join(repoRoot, '.env'), 'LOG_LEVEL=debug\nHOST=127.0.0.1\n');

    const context = loadContext({
      capabilities: ['core'],
      target: 'local',
      repoRoot,
      processEnv: { LOG_LEVEL: 'trace' },
    });

    expect(context.envFileFound).toBe(true);
    expect(context.env.LOG_LEVEL).toBe('trace');
    expect(context.env.HOST).toBe('127.0.0.1');
  });

  it('records a missing env file instead of throwing', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'preflight-'));

    const context = loadContext({
      capabilities: ['core'],
      target: 'local',
      repoRoot,
      processEnv: {},
    });

    expect(context.envFileFound).toBe(false);
    expect(context.env.DATABASE_URL).toBeUndefined();
  });
});
