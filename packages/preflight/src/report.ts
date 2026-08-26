import { CAPABILITIES, CAPABILITY_LABELS, type Capability } from '@vendor-marketplace/shared/env';
import type { CheckResult } from './types.js';

const PASS = '✓';
const FAIL = '✗';

export interface Report {
  readonly lines: readonly string[];
  readonly failures: number;
}

function describe(result: CheckResult): string[] {
  const mark = result.ok ? PASS : FAIL;
  const detail = result.detail ? ` — ${result.detail}` : '';
  const lines = [`  ${mark} ${result.name}${detail}`];

  if (!result.ok && result.fix) {
    lines.push(`      → ${result.fix}`);
  }

  return lines;
}

/**
 * Renders every result grouped by capability. Failures are never short-circuited:
 * the whole point is that fixing five credentials takes one run, not five.
 */
export function renderReport(results: readonly CheckResult[], heading: string): Report {
  const lines: string[] = [heading, ''];
  const failures = results.filter((result) => !result.ok);

  for (const capability of CAPABILITIES) {
    const group = results.filter((result) => result.capability === capability);

    if (group.length === 0) {
      continue;
    }

    const groupFailures = group.filter((result) => !result.ok).length;
    const status = groupFailures === 0 ? PASS : `${FAIL} ${groupFailures} failing`;

    lines.push(`${CAPABILITY_LABELS[capability]}  [${status}]`);
    lines.push(...group.flatMap(describe));
    lines.push('');
  }

  lines.push(
    failures.length === 0
      ? `${PASS} ${results.length} checks passed.`
      : `${FAIL} ${failures.length} of ${results.length} checks failed. Fix the → lines above and re-run.`,
  );

  return { lines, failures: failures.length };
}

export function capabilityList(capabilities: readonly Capability[]): string {
  return capabilities.join(', ');
}
