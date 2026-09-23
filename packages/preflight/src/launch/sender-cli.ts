import { readOnlyGet } from './http.js';
import { renderLaunchReport } from './run.js';
import { releaseSenderResults } from './sender.js';

/**
 * `pnpm release:sender` — the deploy workflow's sender check (VEN-609). Reads
 * `EMAIL_FROM` and `RESEND_API_KEY` from the process environment only: the
 * step that runs it is handed exactly those, and CI has no env file.
 */
const report = renderLaunchReport(
  await releaseSenderResults({ env: process.env, get: readOnlyGet() }),
);

process.stdout.write(`${report.lines.join('\n')}\n`);
process.exitCode = report.failures > 0 ? 1 : 0;
