import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { scanFiles, type Finding, type ScannedFile } from './scan.js';

/**
 * `staged` is what the pre-commit hook runs: it reads the *staged* blob rather
 * than the working tree, so a secret cannot be staged, edited out of the file,
 * and committed anyway. `tracked` is what CI runs, over every file in the
 * checkout, so a hook bypassed with `--no-verify` still fails the pull request.
 */
export type ScanMode = 'staged' | 'tracked';

const MAX_BUFFER = 256 * 1024 * 1024;

/*
 * pnpm runs a package script with the cwd set to that package's directory, so
 * every git invocation is anchored to the repository root explicitly. Without
 * it `git ls-files` returns paths relative to `packages/preflight` while
 * `git show` resolves them from the root — which made the first version of this
 * scanner report a clean tree while silently failing to read almost every file.
 * A scanner that cannot read is more dangerous than no scanner at all.
 */
function repoRoot(): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function git(root: string, args: readonly string[]): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
  });
}

function listPaths(root: string, mode: ScanMode): string[] {
  const args =
    mode === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
      : ['ls-files', '-z'];

  return git(root, args)
    .split('\u0000')
    .filter((entry) => entry.length > 0);
}

export interface Collected {
  readonly files: ScannedFile[];
  /** Paths git listed but whose contents could not be read. Never ignored. */
  readonly unreadable: string[];
}

export function collectFiles(root: string, mode: ScanMode): Collected {
  const files: ScannedFile[] = [];
  const unreadable: string[] = [];

  for (const entry of listPaths(root, mode)) {
    try {
      // Staged mode reads the index blob (`:path`); tracked mode reads the
      // checkout, which is exactly what a merge would publish.
      const content =
        mode === 'staged'
          ? git(root, ['show', `:${entry}`])
          : readFileSync(path.join(root, entry), 'utf8');
      files.push({ path: entry, content });
    } catch {
      unreadable.push(entry);
    }
  }

  return { files, unreadable };
}

export function formatFindings(findings: readonly Finding[], mode: ScanMode): string {
  const lines = [
    '',
    `✗ Secret scan blocked ${findings.length} finding${findings.length === 1 ? '' : 's'}:`,
    '',
  ];

  for (const finding of findings) {
    const where = finding.line === 0 ? finding.path : `${finding.path}:${finding.line}`;
    lines.push(`  ${where}`);
    lines.push(`    ${finding.label} [${finding.rule}] — ${finding.excerpt}`);
  }

  lines.push(
    '',
    'Nothing has been committed. Remove the value, then rotate it — a credential',
    'that reached a file you tried to commit should be treated as compromised,',
    'not merely as nearly leaked.',
    '',
    'If this is a fixture rather than a real credential, mark the line:',
    '',
    '    const key = "sk_test_...";  // secret-scan:allow',
    '',
  );

  if (mode === 'staged') {
    lines.push(
      'Do not reach for `git commit --no-verify`: CI runs this same scan over the',
      'whole tree and will fail the pull request anyway.',
      '',
    );
  }

  return lines.join('\n');
}

function main(): void {
  const mode: ScanMode = process.argv.includes('--tracked') ? 'tracked' : 'staged';
  const root = repoRoot();
  const { files, unreadable } = collectFiles(root, mode);

  if (unreadable.length > 0) {
    process.stderr.write(
      `\n✗ Secret scan could not read ${unreadable.length} file(s):\n` +
        unreadable.map((entry) => `    ${entry}\n`).join('') +
        '\nRefusing to report a clean scan over files it never read.\n\n',
    );
    process.exitCode = 1;
    return;
  }

  const findings = scanFiles(files);

  if (findings.length > 0) {
    process.stderr.write(formatFindings(findings, mode));
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`✓ Secret scan clean — ${files.length} file(s), mode ${mode}.\n`);
}

main();
