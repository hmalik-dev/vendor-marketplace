// The two decisions the CI `e2e` job makes in code rather than in YAML (VEN-411).
//
//   node scripts/e2e-ci.mjs secrets              whether the job can run, and why not
//   node scripts/e2e-ci.mjs summary <report.json> the run's result, retries named
//
// Both write to the files GitHub Actions gives a step (`GITHUB_OUTPUT`,
// `GITHUB_STEP_SUMMARY`) and print workflow commands. Neither ever prints a
// secret's value — only the names of the ones that are missing.
import { appendFileSync, readFileSync } from 'node:fs';

/**
 * `[variable, secret]`: each variable the job's `env:` fills from a repository
 * secret, and that secret's own name — the one a missing value is reported
 * under, since it is what someone adds. Every one is needed: the E2E accounts
 * sign in against the Clerk test instance, `seed:e2e` resolves their Clerk ids
 * and pins the Stripe connected account, and `paid-booking.spec.ts` pays
 * through Stripe test mode.
 */
export const REQUIRED_SECRETS = [
  ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'E2E_CLERK_PUBLISHABLE_KEY'],
  ['CLERK_SECRET_KEY', 'E2E_CLERK_SECRET_KEY'],
  ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'E2E_STRIPE_PUBLISHABLE_KEY'],
  ['STRIPE_SECRET_KEY', 'E2E_STRIPE_SECRET_KEY'],
  ...[
    'E2E_VENDOR_STRIPE_ACCOUNT_ID',
    'E2E_CUSTOMER_EMAIL',
    'E2E_CUSTOMER_PASSWORD',
    'E2E_VENDOR_EMAIL',
    'E2E_VENDOR_PASSWORD',
    'E2E_ADMIN_EMAIL',
    'E2E_ADMIN_PASSWORD',
  ].map((name) => [name, name]),
];

/** The repository variable that turns a missing secret from a warning into a failure. */
export const GATE_VARIABLE = 'E2E_GATE';

/**
 * Whether the suite can run.
 *
 * Until the account holder adds the secrets (VEN-377) the job cannot drive a
 * signed-in journey, and failing it on every pull request would stop the whole
 * fleet merging for a console task. So a missing secret **skips** the suite,
 * loudly — until `E2E_GATE=required` is set, after which it **fails**: a gate
 * someone has switched on must not be switched off again by a deleted secret.
 */
export function secretsVerdict(env) {
  const missing = REQUIRED_SECRETS.filter(([variable]) => !env[variable]?.trim()).map(
    ([, secret]) => secret,
  );
  const required = env[GATE_VARIABLE]?.trim() === 'required';

  if (missing.length === 0) return { run: true, fail: false, missing, message: null };

  const names = missing.join(', ');
  return required
    ? {
        run: false,
        fail: true,
        missing,
        message: `${GATE_VARIABLE}=required but these secrets are missing: ${names}`,
      }
    : {
        run: false,
        fail: false,
        missing,
        message: `e2e suite NOT run — secrets missing: ${names} (VEN-377). Set ${GATE_VARIABLE}=required once they exist.`,
      };
}

/** Every test in a Playwright JSON report, with the file and project it ran under. */
function collectTests(suite, out = []) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      out.push({
        title: `${spec.file ?? suite.file ?? ''} › ${spec.title}`,
        project: test.projectName,
        status: test.status,
      });
    }
  }
  for (const child of suite.suites ?? []) collectTests(child, out);
  return out;
}

/**
 * The run as the summary reports it. A test Playwright marks `flaky` failed its
 * first attempt and passed its retry: it did not block the merge, and it is
 * named here so it cannot pass unnoticed either.
 */
export function summarizeReport(report) {
  const tests = (report.suites ?? []).flatMap((suite) => collectTests(suite));
  const named = (status) =>
    tests.filter((test) => test.status === status).map((test) => `[${test.project}] ${test.title}`);

  return {
    passed: tests.filter((test) => test.status === 'expected').length,
    failed: named('unexpected'),
    retried: named('flaky'),
    skipped: tests.filter((test) => test.status === 'skipped').length,
    durationMs: Math.round(report.stats?.duration ?? 0),
  };
}

export function renderSummary(summary) {
  const minutes = (summary.durationMs / 60_000).toFixed(1);
  const lines = [
    '### End-to-end journeys',
    '',
    `${summary.passed} passed · ${summary.failed.length} failed · ${summary.retried.length} passed only on retry · ${summary.skipped} skipped · ${minutes} min`,
  ];
  if (summary.retried.length > 0) {
    lines.push('', '**Passed only on retry** — a flake is a defect, not a pass:', '');
    for (const title of summary.retried) lines.push(`- ${title}`);
  }
  if (summary.failed.length > 0) {
    lines.push('', '**Failed:**', '');
    for (const title of summary.failed) lines.push(`- ${title}`);
  }
  return `${lines.join('\n')}\n`;
}

function append(file, text) {
  if (file) appendFileSync(file, text);
}

function main([command, reportPath]) {
  const env = process.env;

  if (command === 'secrets') {
    const verdict = secretsVerdict(env);
    append(env.GITHUB_OUTPUT, `run=${verdict.run}\n`);
    if (verdict.message) {
      process.stdout.write(`::${verdict.fail ? 'error' : 'warning'}::${verdict.message}\n`);
      append(env.GITHUB_STEP_SUMMARY, `### End-to-end journeys\n\n${verdict.message}\n`);
    }
    return verdict.fail ? 1 : 0;
  }

  if (command === 'summary' && reportPath) {
    const summary = summarizeReport(JSON.parse(readFileSync(reportPath, 'utf8')));
    for (const title of summary.retried) {
      process.stdout.write(`::warning title=Passed only on retry::${title}\n`);
    }
    append(env.GITHUB_STEP_SUMMARY, renderSummary(summary));
    process.stdout.write(renderSummary(summary));
    return 0;
  }

  process.stderr.write('usage: e2e-ci.mjs secrets | summary <playwright-report.json>\n');
  return 64;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
