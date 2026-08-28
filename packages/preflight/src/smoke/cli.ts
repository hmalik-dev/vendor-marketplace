import { runSmokeCheck } from './smoke.js';

/**
 * The post-deploy smoke check, as CI runs it.
 *
 * It **fails loudly and stops there** — no automatic rollback. Rolling back on
 * a red smoke check would mean an automated system reverting production on the
 * strength of three requests, and a flaky network would then undo a good
 * deploy. Reporting the failure is the job; deciding what to do about it is a
 * person's.
 */
const apiUrl = process.env.SMOKE_API_URL;
const webUrl = process.env.SMOKE_WEB_URL;

if (!apiUrl || !webUrl) {
  process.stderr.write('SMOKE_API_URL and SMOKE_WEB_URL must both be set.\n');
  process.exit(1);
}

const deadlineMs = Number(process.env.SMOKE_DEADLINE_MS ?? 180_000);
// Optional so the check can be pointed at a running environment by hand; in CI
// it is always the pushed commit, which is what makes the check wait for *this*
// deploy rather than accepting the previous one's word for it.
const expectCommit = process.env.SMOKE_COMMIT?.trim() || undefined;

process.stdout.write(
  `Smoke check\n  api ${apiUrl}\n  web ${webUrl}\n` +
    (expectCommit ? `  commit ${expectCommit.slice(0, 7)}\n\n` : '\n'),
);

const result = await runSmokeCheck({ apiUrl, webUrl, deadlineMs, expectCommit });

for (const check of result.checks) {
  process.stdout.write(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name} — ${check.detail}\n`);
}

if (!result.ok) {
  process.stderr.write(
    '\nThe deployment is live but not serving. It has NOT been rolled back — ' +
      'decide whether to revert or fix forward.\n',
  );
  process.exit(1);
}

process.stdout.write('\nThe deployment answers with real data.\n');
