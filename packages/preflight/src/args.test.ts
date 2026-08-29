import { isRegisteredTicket } from '@vendor-marketplace/shared/env';
import { describe, expect, it } from 'vitest';

import { ArgumentError, parseArgs, resolveCapabilities } from './args.js';

describe('parseArgs', () => {
  it('defaults to the local target and no ticket', () => {
    expect(parseArgs([])).toEqual({ target: 'local', help: false });
  });

  it('reads a ticket number', () => {
    expect(parseArgs(['--ticket', '9'])).toEqual({ ticket: 9, target: 'local', help: false });
  });

  it('reads a production target', () => {
    expect(parseArgs(['--env', 'production'])).toEqual({ target: 'production', help: false });
  });

  it('combines a ticket and a target in either order', () => {
    expect(parseArgs(['--env', 'production', '--ticket', '10'])).toEqual({
      ticket: 10,
      target: 'production',
      help: false,
    });
  });

  it('rejects a ticket that is not a number', () => {
    expect(() => parseArgs(['--ticket', 'nine'])).toThrow(ArgumentError);
  });

  it('rejects a missing ticket value rather than swallowing the next flag', () => {
    expect(() => parseArgs(['--ticket', '--env'])).toThrow(/--ticket needs a ticket number/);
  });

  it('rejects an unknown target', () => {
    expect(() => parseArgs(['--env', 'staging'])).toThrow(/--env must be one of/);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseArgs(['--everything'])).toThrow(/Unknown argument/);
  });
});

describe('resolveCapabilities', () => {
  it('checks only the baseline without a ticket', () => {
    expect(resolveCapabilities(parseArgs([]))).toEqual(['core', 'e2e']);
  });

  it('adds a ticket declared capabilities', () => {
    expect(resolveCapabilities(parseArgs(['--ticket', '9']))).toEqual([
      'core',
      'auth',
      'stripe',
      'e2e',
    ]);
  });

  // This used to throw. The registry then fell 192 rows behind the status board,
  // which turned every ticket filed since #37 into an unrunnable gate — the stop
  // punished the operator, not the stale data. An unregistered ticket now falls
  // back to the baseline, and `isRegisteredTicket` is what the CLI warns on.
  it('falls back to the baseline for an unregistered ticket, and never to nothing', () => {
    const resolved = resolveCapabilities(parseArgs(['--ticket', '999']));

    expect(isRegisteredTicket(999)).toBe(false);
    expect(resolved).toEqual(['core', 'e2e']);
  });

  it('still narrows to the declared capabilities for a registered ticket', () => {
    expect(isRegisteredTicket(165)).toBe(true);
    expect(resolveCapabilities(parseArgs(['--ticket', '165']))).toEqual(['core', 'e2e']);
    expect(resolveCapabilities(parseArgs(['--ticket', '170']))).toEqual(['core', 'storage', 'e2e']);
  });
});
