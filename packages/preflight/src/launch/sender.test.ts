import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { HttpGet } from './http.js';
import { releaseSenderResults } from './sender.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FROM = 'Orla <noreply@send.orla.test>';
const DOMAIN = 'send.orla.test';
/** Assembled at runtime so no literal in this file reads as a real credential. */
const RESEND = ['re', 'FAKEabcdefghijklmnop9005'].join('_');

/** A Resend double answering `GET /domains` with one account holding `DOMAIN` at `status`. */
function domains(status: string, httpStatus = 200): HttpGet {
  return async (url) => {
    expect(url).toBe('https://api.resend.com/domains');
    return {
      status: httpStatus,
      headers: new Headers(),
      body:
        httpStatus === 200
          ? {
              data: [
                { name: 'orla.test', status: 'verified' },
                { name: DOMAIN, status },
              ],
            }
          : { name: 'restricted_api_key' },
    };
  };
}

async function check(get: HttpGet, from = FROM) {
  const results = await releaseSenderResults({
    env: { EMAIL_FROM: from, RESEND_API_KEY: RESEND },
    get,
  });

  expect(results).toHaveLength(1);
  return results[0]!;
}

describe('the release sender check (VEN-609)', () => {
  it('passes a verified sending domain', async () => {
    expect(await check(domains('verified'))).toEqual({
      group: 'resend',
      name: 'resend sending domain',
      status: 'PASS',
      detail: `${DOMAIN} is verified`,
    });
  });

  it.each(['not_started', 'pending', 'failed', 'temporary_failure'])(
    'fails a domain that is %s, naming it',
    async (status) => {
      expect(await check(domains(status))).toMatchObject({
        status: 'FAIL',
        detail: `${DOMAIN} is ${status} (expected verified)`,
      });
    },
  );

  it('fails a domain the Resend account does not hold, naming it', async () => {
    expect(await check(domains('verified'), 'noreply@orla.com')).toMatchObject({
      status: 'FAIL',
      detail: 'orla.com is not in the Resend account (expected verified)',
    });
  });

  /*
   * launch:check reports these as MANUAL for a person to confirm by hand. A
   * release has no person reading it, so the same answer fails, with the fix.
   */
  it.each([401, 403])(
    'fails a key that cannot list domains (HTTP %i), naming the domain and the fix',
    async (httpStatus) => {
      expect(await check(domains('verified', httpStatus))).toEqual({
        group: 'resend',
        name: 'resend sending domain',
        status: 'FAIL',
        detail: `RESEND_API_KEY cannot list domains (HTTP ${httpStatus}) — confirm ${DOMAIN} is verified in the Resend dashboard; a release must prove it, so give this GitHub environment's RESEND_API_KEY secret domain read access (a full-access Resend key)`,
      });
    },
  );

  it('fails an EMAIL_FROM with no address rather than passing it', async () => {
    expect(await check(domains('verified'), '')).toMatchObject({
      status: 'FAIL',
      detail: 'EMAIL_FROM has no parseable address',
    });
  });

  it('fails when Resend cannot be reached', async () => {
    const get: HttpGet = async () => {
      throw new Error('fetch failed');
    };

    expect(await check(get)).toMatchObject({ status: 'FAIL', detail: 'fetch failed' });
  });

  /*
   * The script the deploy step runs, invoked directly with a faked Resend
   * answer: the line an operator reads in the Actions log, and the exit code
   * that stops the release before anything migrates.
   */
  it.each([
    ['pending', 1, `FAIL    resend sending domain: ${DOMAIN} is pending (expected verified)`],
    ['verified', 0, `PASS    resend sending domain: ${DOMAIN} is verified`],
  ])('the release:sender script on a %s domain exits %i', (status, code, line) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'release-sender-'));
    try {
      const fake = path.join(dir, 'resend-fetch.mjs');
      writeFileSync(
        fake,
        `globalThis.fetch = async () => Response.json({ data: [{ name: ${JSON.stringify(DOMAIN)}, status: ${JSON.stringify(status)} }] });\n`,
      );
      const result = spawnSync(
        process.execPath,
        ['--import', pathToFileURL(fake).href, '--import', 'tsx', 'src/launch/sender-cli.ts'],
        {
          cwd: PACKAGE_ROOT,
          env: { PATH: process.env.PATH, EMAIL_FROM: FROM, RESEND_API_KEY: RESEND },
          encoding: 'utf8',
        },
      );

      expect(result.stderr).toBe('');
      expect(result.stdout).toContain(line);
      expect(result.stdout).not.toContain(RESEND);
      expect(result.status).toBe(code);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
