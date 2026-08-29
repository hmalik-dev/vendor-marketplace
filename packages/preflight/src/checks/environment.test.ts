import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type EnvVariable, findVariable } from '@vendor-marketplace/shared/env';
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
const CLERK_PUBLISHABLE_KEY = findVariable('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')!;
const CLERK_WEBHOOK = findVariable('CLERK_WEBHOOK_SECRET')!;
const API_URL = findVariable('API_URL')!;
const EMAIL_FROM = findVariable('EMAIL_FROM')!;

/*
 * Live-mode fixtures are assembled from a row's own placeholder rather than
 * written out, following the idiom in `secrets/scan.test.ts`: the checker sees
 * exactly what an operator would paste, while the source file holds no live-key
 * token for a scanner — this repository's own included — to trip over.
 */
function liveKeyFor(variable: EnvVariable): string {
  return variable
    .placeholder!.replace('...', '51ABCdefGHIjklMNO')
    .replace(`_${variable.modes!.local}_`, `_${variable.modes!.production}_`);
}

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
    expect(result.detail).toBe('is a test key — the production target needs a live key');
    // Naming the mode is only half the fix: a hint that links to the page which
    // issues test keys sends the operator straight back to the value that just
    // failed.
    expect(result.fix).toContain('https://dashboard.stripe.com/apikeys');
    expect(result.fix).not.toContain('/test/apikeys');
  });

  it('rejects a live Stripe key against a local target', () => {
    // The mirror of the case above, and the one this ticket exists for: a
    // perfectly valid key, pointed at a laptop, spending real money.
    const result = evaluateVariable(
      STRIPE_KEY,
      contextWith({ [STRIPE_KEY.key]: liveKeyFor(STRIPE_KEY) }),
    );

    expect(result.ok).toBe(false);
    expect(result.detail).toBe('is a live key — the local target needs a test key');
    expect(result.fix).toContain('https://dashboard.stripe.com/test/apikeys');
  });

  it('rejects a live Clerk key against a local target too, not only Stripe', () => {
    const result = evaluateVariable(
      CLERK_PUBLISHABLE_KEY,
      contextWith({ [CLERK_PUBLISHABLE_KEY.key]: liveKeyFor(CLERK_PUBLISHABLE_KEY) }),
    );

    expect(result.ok).toBe(false);
    expect(result.detail).toBe('is a live key — the local target needs a test key');
  });

  it('never echoes the live key it just rejected', () => {
    const live = liveKeyFor(STRIPE_KEY);
    const result = evaluateVariable(STRIPE_KEY, contextWith({ [STRIPE_KEY.key]: live }));

    expect(JSON.stringify(result)).not.toContain(live);
  });

  it('reports a malformed live-prefixed value as a shape failure, not a mode failure', () => {
    // Prefix alone is not a mode: this matches neither target's shape, so the
    // operator needs the syntax, not a lecture about environments.
    const truncated = liveKeyFor(STRIPE_KEY).slice(0, 8);
    const result = evaluateVariable(STRIPE_KEY, contextWith({ [STRIPE_KEY.key]: truncated }));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('local shape');
  });

  it('leaves a credential carrying no mode in its prefix alone in both targets', () => {
    const value = ['whsec', '9QmZp0RvT7bNw4LcYdF1sHgU'].join('_');
    const env = { [CLERK_WEBHOOK.key]: value };

    expect(evaluateVariable(CLERK_WEBHOOK, contextWith(env)).ok).toBe(true);
    expect(evaluateVariable(CLERK_WEBHOOK, contextWith(env, 'production')).ok).toBe(true);
  });

  it('reports an absent mode-carrying credential as unset, not as the wrong mode', () => {
    const result = evaluateVariable(STRIPE_KEY, contextWith({}));

    expect(result.ok).toBe(false);
    expect(result.detail).toBe('not set in .env');
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

  it('fails the run a live key is set for, on the same path the CLI takes', async () => {
    // The acceptance criterion, driven through `Check.run` rather than through
    // `evaluateVariable`: `pnpm preflight` must not print "set, shape ok" for a
    // key that spends real money.
    const results = await environmentCheck.run(
      contextWith({
        [STRIPE_KEY.key]: liveKeyFor(STRIPE_KEY),
        [CLERK_PUBLISHABLE_KEY.key]: liveKeyFor(CLERK_PUBLISHABLE_KEY),
      }),
    );
    const byName = new Map(results.map((result) => [result.name, result]));

    for (const variable of [STRIPE_KEY, CLERK_PUBLISHABLE_KEY]) {
      expect(byName.get(variable.key)?.ok, variable.key).toBe(false);
      expect(byName.get(variable.key)?.detail, variable.key).toBe(
        'is a live key — the local target needs a test key',
      );
    }
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

/*
 * Ticket #200 moved local development onto the Docker Postgres, which has no
 * pooler to bypass and no Neon branch to name. Both rows stayed *required*, so
 * a correctly configured laptop failed the gate on two variables it must not
 * set. Production is unchanged: staging and prod are Neon and still need them.
 */
describe('Neon-only rows are optional off Neon', () => {
  const unpooled = findVariable('DATABASE_URL_UNPOOLED')!;
  const branch = findVariable('NEON_BRANCH')!;

  it('passes locally when the Neon-only rows are unset', () => {
    for (const variable of [unpooled, branch]) {
      const result = evaluateVariable(variable, contextWith({}, 'local'));

      expect(result.ok).toBe(true);
      expect(result.detail).toBe('unset, and not required for the local target');
    }
  });

  it('still fails production when they are unset', () => {
    for (const variable of [unpooled, branch]) {
      const result = evaluateVariable(variable, contextWith({}, 'production'));

      expect(result.ok).toBe(false);
    }
  });

  it('leaves a row without the marker required locally', () => {
    const result = evaluateVariable(findVariable('DATABASE_URL')!, contextWith({}, 'local'));

    expect(result.ok).toBe(false);
  });
});
