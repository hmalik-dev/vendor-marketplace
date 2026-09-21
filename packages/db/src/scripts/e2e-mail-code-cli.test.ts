import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'e2e-mail-code-cli.ts');
const KEY = 'sentinel-mail-key-value';
const SERVER = 'abc1de23';

function run(args: string[], env: Record<string, string>): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, ['--import', 'tsx', CLI, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', E2E_MAIL_API_KEY: KEY, E2E_MAIL_SERVER: SERVER, ...env },
  });
}

describe('e2e-mail-code command', () => {
  it.each([
    ['a foreign address', ['someone@example.com'], {}],
    ['a non-local DEPLOY_ENV', [`a@${SERVER}.mailosaur.net`], { DEPLOY_ENV: 'production' }],
    ['no address', [], {}],
  ])('exits 1 with nothing on stdout and no secret on stderr for %s', (_name, args, env) => {
    const result = run(args, env);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(String(result.stderr)).not.toContain(KEY);
    expect(String(result.stderr)).not.toContain(SERVER);
    expect(String(result.stderr).trim().split('\n')).toHaveLength(1);
  });
});
