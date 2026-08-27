import { FORBIDDEN_PATHS, KNOWN_FIXTURES, SECRET_RULES } from './patterns.js';

export interface ScannedFile {
  readonly path: string;
  readonly content: string;
}

export interface Finding {
  readonly path: string;
  /** 1-indexed; 0 for a finding about the file itself rather than a line. */
  readonly line: number;
  readonly rule: string;
  readonly label: string;
  /** The match with its middle removed — never the whole credential. */
  readonly excerpt: string;
}

/** Silences one line; the line above the match also counts, for wrapped code. */
const LINE_PRAGMA = 'secret-scan:allow';
/** Silences a whole file. Reserved for fixtures that exist to be scanned. */
const FILE_PRAGMA = 'secret-scan:allow-file';

/**
 * Shows enough of a match to identify it without reprinting the credential.
 * A scanner that echoes the secret into CI logs has moved the leak rather
 * than stopped it.
 */
export function redact(match: string): string {
  /*
   * Enough to identify which credential is meant — the provider prefix and the
   * length — and no more. Findings travel into CI logs and terminal scrollback,
   * so revealing a trailing fragment of a short secret would meaningfully
   * shrink the work of guessing the rest.
   */
  const shown = Math.min(6, Math.floor(match.length / 3));
  return `${match.slice(0, shown)}… (${match.length} chars)`;
}

function isBinary(content: string): boolean {
  return content.includes('\u0000');
}

export function scanFile(file: ScannedFile): Finding[] {
  const forbidden = FORBIDDEN_PATHS.find((entry) => entry.test(file.path));
  if (forbidden) {
    return [
      {
        path: file.path,
        line: 0,
        rule: 'forbidden-path',
        label: forbidden.label,
        excerpt: file.path,
      },
    ];
  }

  if (isBinary(file.content) || file.content.includes(FILE_PRAGMA)) {
    return [];
  }

  const lines = file.content.split('\n');
  const findings: Finding[] = [];

  for (const rule of SECRET_RULES) {
    // The rules are module-level and carry `g`, so `lastIndex` has to be reset
    // or the second file scanned starts partway through its own content.
    rule.pattern.lastIndex = 0;

    let match: RegExpExecArray | null = rule.pattern.exec(file.content);
    while (match !== null) {
      /*
       * A rule may match a whole `KEY = "value"` assignment, so the allowlist
       * is checked against every captured group as well as the full match —
       * otherwise a known fixture is exempt from the token rules but still
       * trips the generic one.
       */
      const isFixture = [...match].some(
        (part) => typeof part === 'string' && KNOWN_FIXTURES.has(part),
      );

      if (!isFixture && (!rule.confirm || rule.confirm(match))) {
        const lineIndex = file.content.slice(0, match.index).split('\n').length - 1;
        const current = lines[lineIndex] ?? '';
        const previous = lineIndex > 0 ? (lines[lineIndex - 1] ?? '') : '';

        if (!current.includes(LINE_PRAGMA) && !previous.includes(LINE_PRAGMA)) {
          findings.push({
            path: file.path,
            line: lineIndex + 1,
            rule: rule.id,
            label: rule.label,
            excerpt: redact(match[0]),
          });
        }
      }

      // A zero-length match would spin forever.
      if (match.index === rule.pattern.lastIndex) rule.pattern.lastIndex += 1;
      match = rule.pattern.exec(file.content);
    }
  }

  return findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

export function scanFiles(files: readonly ScannedFile[]): Finding[] {
  return files.flatMap((file) => scanFile(file));
}
