import { describe, expect, it } from 'vitest';

import { ArgumentError, parseArgs } from './args.js';

describe('parseArgs', () => {
  it('defaults to the local target and the baseline capabilities', () => {
    expect(parseArgs([])).toEqual({ capabilities: ['core', 'e2e'], target: 'local', help: false });
  });

  it('adds the requested capabilities to the baseline, in registry order', () => {
    expect(parseArgs(['--capabilities', 'stripe,auth']).capabilities).toEqual([
      'core',
      'auth',
      'stripe',
      'e2e',
    ]);
  });

  it('accepts the flag more than once and tolerates whitespace', () => {
    expect(
      parseArgs(['--capabilities', 'auth', '--capabilities', ' storage , auth']).capabilities,
    ).toEqual(['core', 'auth', 'storage', 'e2e']);
  });

  it('checks everything with --all', () => {
    expect(parseArgs(['--all']).capabilities).toEqual([
      'core',
      'auth',
      'storage',
      'stripe',
      'email',
      'sentry',
      'e2e',
    ]);
  });

  it('unions --all with --capabilities instead of letting either win', () => {
    expect(parseArgs(['--capabilities', 'auth', '--all']).capabilities).toEqual([
      'core',
      'auth',
      'storage',
      'stripe',
      'email',
      'sentry',
      'e2e',
    ]);
    expect(parseArgs(['--all', '--capabilities', 'auth']).capabilities).toHaveLength(7);
  });

  it('reads a production target', () => {
    expect(parseArgs(['--env', 'production'])).toEqual({
      capabilities: ['core', 'e2e'],
      target: 'production',
      help: false,
    });
  });

  it('combines capabilities and a target in either order', () => {
    expect(parseArgs(['--env', 'production', '--capabilities', 'stripe'])).toEqual({
      capabilities: ['core', 'stripe', 'e2e'],
      target: 'production',
      help: false,
    });
  });

  it('rejects a capability the registry does not know', () => {
    expect(() => parseArgs(['--capabilities', 'auth,payments'])).toThrow(/got payments/);
    expect(() => parseArgs(['--capabilities', 'auth,payments'])).toThrow(ArgumentError);
  });

  it('rejects an empty list', () => {
    expect(() => parseArgs(['--capabilities', ','])).toThrow(/accepts only/);
  });

  it('rejects a missing value rather than swallowing the next flag', () => {
    expect(() => parseArgs(['--capabilities', '--env'])).toThrow(
      /--capabilities needs a comma-separated list/,
    );
    expect(() => parseArgs(['--capabilities'])).toThrow(ArgumentError);
  });

  it('rejects an unknown target', () => {
    expect(() => parseArgs(['--env', 'staging'])).toThrow(/--env must be one of/);
  });

  it('rejects the retired --ticket flag as unknown', () => {
    expect(() => parseArgs(['--ticket', '9'])).toThrow(/Unknown argument `--ticket`/);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseArgs(['--everything'])).toThrow(/Unknown argument/);
  });
});
