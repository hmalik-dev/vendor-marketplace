import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENV_REGISTRY } from './registry.js';
import {
  passThroughKeys,
  renderEnvExample,
  renderTurboJson,
  TURBO_GLOBAL_ENV_KEYS,
} from './generate.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function read(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), 'utf8');
}

describe('renderEnvExample', () => {
  it('is deterministic', () => {
    expect(renderEnvExample()).toBe(renderEnvExample());
  });

  it('emits every registry key exactly once', () => {
    const rendered = renderEnvExample();

    for (const variable of ENV_REGISTRY) {
      const assignments = rendered
        .split('\n')
        .filter((line) => line.startsWith(`${variable.key}=`));

      expect(assignments, variable.key).toHaveLength(1);
    }
  });

  it('warns that the file is generated', () => {
    expect(renderEnvExample()).toContain('DO NOT EDIT BY HAND');
  });

  it('ends with exactly one trailing newline', () => {
    const rendered = renderEnvExample();

    expect(rendered.endsWith('\n')).toBe(true);
    expect(rendered.endsWith('\n\n')).toBe(false);
  });
});

describe('passThroughKeys', () => {
  it('is sorted, deduplicated, and excludes the cache-busting globalEnv keys', () => {
    const keys = passThroughKeys();

    expect(keys).toEqual([...keys].sort((left, right) => left.localeCompare(right, 'en')));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('NODE_ENV');
    expect(keys).not.toContain('CSP_ENFORCE');
    expect(keys).toContain('DATABASE_URL_UNPOOLED');
  });

  /*
   * `globalEnv` is hand-maintained in `turbo.json` while the pass-through
   * block is generated; the two only stay disjoint if this pins them together.
   * A key present in neither is invisible to the build, one in pass-through
   * that changes output is a stale cache waiting to be replayed (#396).
   */
  it('matches the globalEnv block turbo.json actually carries', () => {
    const turbo = JSON.parse(read('turbo.json')) as { globalEnv: string[] };

    expect([...turbo.globalEnv].sort()).toEqual([...TURBO_GLOBAL_ENV_KEYS].sort());
  });
});

describe('renderTurboJson', () => {
  it('is idempotent', () => {
    const once = renderTurboJson(read('turbo.json'));

    expect(renderTurboJson(once)).toBe(once);
  });

  it('changes nothing outside the passthrough array', () => {
    const current = read('turbo.json');
    const stripped = (text: string): string =>
      text.replace(/^ {2}"globalPassThroughEnv": \[\n(?: {4}.*\n)* {2}\],$/m, 'PASSTHROUGH');

    expect(stripped(renderTurboJson(current))).toBe(stripped(current));
  });

  it('refuses to guess when the array is missing', () => {
    expect(() => renderTurboJson('{\n  "tasks": {}\n}\n')).toThrow(/globalPassThroughEnv/);
  });

  it('produces valid JSON whose array matches passThroughKeys', () => {
    const parsed: unknown = JSON.parse(renderTurboJson(read('turbo.json')));
    const passthrough = (parsed as { globalPassThroughEnv?: unknown }).globalPassThroughEnv;

    expect(passthrough).toEqual(passThroughKeys());
  });
});

describe('committed files match the registry', () => {
  // The drift gate. `.env.example` and `turbo.json` used to be hand-maintained
  // copies of the variable list; this test is what stops them diverging again.
  it('.env.example equals the generated output', () => {
    expect(read('.env.example')).toBe(renderEnvExample());
  });

  it('turbo.json equals the generated output', () => {
    const current = read('turbo.json');

    expect(current).toBe(renderTurboJson(current));
  });
});
