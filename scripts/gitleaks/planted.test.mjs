/**
 * VEN-397, AC 4: gitleaks, under the repository's own `.gitleaks.toml`, flags a
 * credential planted in a test fixture.
 *
 * Without this the CI scan could pass forever for the wrong reason — a config
 * that allowlisted too much, or a binary that scanned nothing. The fixture is
 * written at run time rather than committed, and its value is composed from
 * parts, so no credential-shaped literal exists anywhere in the tree for the
 * scan itself, or for the pre-commit scanner, to trip on.
 *
 * Needs the `gitleaks` binary, which CI's secret-scan job installs at a pinned,
 * checksummed version. It lives outside `scripts/*.test.mjs` so that
 * `pnpm test:agents` does not require the binary on every laptop.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG = path.join(ROOT, '.gitleaks.toml');
const BINARY = process.env.GITLEAKS_BIN ?? 'gitleaks';

/** A GitHub personal access token's shape: `ghp_` and 36 characters. Not a real one. */
const PLANTED = ['ghp', 'R7mQ2vXk9LpT4wYb8NcZ3HdJ6FsA1GeU0oPi'].join('_');

function scan(fixtureDir) {
  const report = path.join(fixtureDir, '..', 'report.json');
  const result = spawnSync(
    BINARY,
    [
      'dir',
      fixtureDir,
      '--config',
      CONFIG,
      '--no-banner',
      '--redact',
      '--exit-code',
      '3',
      '--report-format',
      'json',
      '--report-path',
      report,
    ],
    { encoding: 'utf8' },
  );

  assert.equal(result.error, undefined, `gitleaks could not run: ${result.error?.message}`);
  return { status: result.status, findings: JSON.parse(readFileSync(report, 'utf8')), result };
}

test('gitleaks flags a credential planted in a test fixture, under this repository config', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gitleaks-planted-'));
  try {
    const fixtures = path.join(dir, 'fixtures');
    mkdirSync(fixtures);
    writeFileSync(
      path.join(fixtures, 'deploy.fixture.ts'),
      `export const client = { token: '${PLANTED}' };\n`,
    );

    const { status, findings, result } = scan(fixtures);

    assert.equal(status, 3, result.stderr);
    assert.deepEqual(
      findings.map((finding) => [finding.RuleID, path.basename(finding.File)]),
      [['github-pat', 'deploy.fixture.ts']],
    );
    // `--redact`: the report and the log name the finding, never the value.
    assert.ok(!JSON.stringify(findings).includes(PLANTED));
    assert.ok(!result.stdout.includes(PLANTED) && !result.stderr.includes(PLANTED));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the same scan passes a fixture with nothing planted, so the flag above is the credential', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'gitleaks-clean-'));
  try {
    const fixtures = path.join(dir, 'fixtures');
    mkdirSync(fixtures);
    writeFileSync(
      path.join(fixtures, 'deploy.fixture.ts'),
      'export const client = { token: process.env.GITHUB_TOKEN };\n',
    );

    const { status, findings } = scan(fixtures);

    assert.equal(status, 0);
    assert.deepEqual(findings, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
