import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  E2E_ACCOUNTS,
  E2E_ENV_FILE,
  E2E_KEYS,
  browsersPath,
  evaluateBrowsers,
  evaluateE2eCredentials,
} from './browser.js';

describe('browsersPath', () => {
  it('honours an explicit override', () => {
    expect(browsersPath({ PLAYWRIGHT_BROWSERS_PATH: '/tmp/pw' })).toBe('/tmp/pw');
  });

  it('ignores the "0" sentinel, which means "next to the package"', () => {
    expect(browsersPath({ PLAYWRIGHT_BROWSERS_PATH: '0' })).not.toBe('0');
  });
});

describe('evaluateBrowsers', () => {
  it('passes when a chromium build is cached', () => {
    const cache = mkdtempSync(path.join(os.tmpdir(), 'pw-'));
    mkdirSync(path.join(cache, 'chromium-1234'));

    const result = evaluateBrowsers({ PLAYWRIGHT_BROWSERS_PATH: cache });

    expect(result.ok).toBe(true);
    expect(result.detail).toContain('chromium-1234');
  });

  it('fails with the install command when the cache is empty', () => {
    const cache = mkdtempSync(path.join(os.tmpdir(), 'pw-'));

    const result = evaluateBrowsers({ PLAYWRIGHT_BROWSERS_PATH: cache });

    expect(result.ok).toBe(false);
    expect(result.fix).toBe('npx playwright install chromium');
  });

  it('fails rather than throwing when the cache directory does not exist', () => {
    const result = evaluateBrowsers({ PLAYWRIGHT_BROWSERS_PATH: '/nonexistent/ms-playwright' });

    expect(result.ok).toBe(false);
  });
});

const BOTH_ACCOUNTS = [
  'E2E_CUSTOMER_EMAIL=customer@b.test',
  'E2E_CUSTOMER_PASSWORD=hunter2',
  'E2E_VENDOR_EMAIL=vendor@b.test',
  'E2E_VENDOR_PASSWORD=hunter2',
].join('\n');

describe('E2E_ACCOUNTS', () => {
  it('covers both sides of the marketplace', () => {
    expect(E2E_ACCOUNTS.map((account) => account.role)).toEqual(['customer', 'vendor']);
  });

  it('expands to an email and a password key per role', () => {
    expect(E2E_KEYS).toEqual([
      'E2E_CUSTOMER_EMAIL',
      'E2E_CUSTOMER_PASSWORD',
      'E2E_VENDOR_EMAIL',
      'E2E_VENDOR_PASSWORD',
    ]);
  });
});

describe('evaluateE2eCredentials', () => {
  it('passes when both accounts are present', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    writeFileSync(path.join(repoRoot, E2E_ENV_FILE), `${BOTH_ACCOUNTS}\n`);

    expect(evaluateE2eCredentials(repoRoot).ok).toBe(true);
  });

  it('names the key that is missing', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    writeFileSync(path.join(repoRoot, E2E_ENV_FILE), 'E2E_CUSTOMER_EMAIL=customer@b.test\n');

    const result = evaluateE2eCredentials(repoRoot);

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('E2E_CUSTOMER_PASSWORD');
  });

  it('fails when only the customer account is configured', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'pf-'));
    writeFileSync(
      path.join(repoRoot, E2E_ENV_FILE),
      'E2E_CUSTOMER_EMAIL=customer@b.test\nE2E_CUSTOMER_PASSWORD=hunter2\n',
    );

    const result = evaluateE2eCredentials(repoRoot);

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('E2E_VENDOR_EMAIL');
    expect(result.detail).toContain('E2E_VENDOR_PASSWORD');
  });

  it('fails when the file is absent', () => {
    const result = evaluateE2eCredentials(mkdtempSync(path.join(os.tmpdir(), 'pf-')));

    expect(result.ok).toBe(false);
    expect(result.detail).toContain('is absent');
  });
});
