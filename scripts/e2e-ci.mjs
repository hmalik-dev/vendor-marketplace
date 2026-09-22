// The decisions the CI `e2e` job makes in code rather than in YAML (VEN-411).
//
//   node scripts/e2e-ci.mjs secrets                whether the job can run, and why not
//   node scripts/e2e-ci.mjs select <changed-files>  which specs this diff and trigger need
//   node scripts/e2e-ci.mjs summary <report.json>   the run's result, retries named
//
// All three write to the files GitHub Actions gives a step (`GITHUB_OUTPUT`,
// `GITHUB_STEP_SUMMARY`) and print workflow commands. `secrets` never prints a
// secret's value, only the names of the ones that are missing.
import { appendFileSync, readFileSync } from 'node:fs';

/**
 * `[variable, secret]`: each variable the job's `env:` fills from a repository
 * secret, and that secret's own name — the one a missing value is reported
 * under, since it is what someone adds. Every one is needed: the E2E accounts
 * sign in against the Neon Auth dev branch, `seed:e2e` resolves their Neon ids
 * and pins the Stripe connected account, and `paid-booking.spec.ts` pays
 * through Stripe test mode.
 */
export const REQUIRED_SECRETS = [
  ['NEON_AUTH_BASE_URL', 'E2E_NEON_AUTH_BASE_URL'],
  ['NEON_AUTH_COOKIE_SECRET', 'E2E_NEON_AUTH_COOKIE_SECRET'],
  ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'E2E_STRIPE_PUBLISHABLE_KEY'],
  ['STRIPE_SECRET_KEY', 'E2E_STRIPE_SECRET_KEY'],
  // Creates this run's storage branch (VEN-457); the same secret preview-branch.yml holds.
  ['NEON_API_KEY', 'NEON_API_KEY'],
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

/**
 * Push branches that always get the full suite: a release is where the
 * minutes are worth spending, whatever the diff (VEN-411 AC7).
 */
const FULL_SUITE_REFS = new Set(['refs/heads/staging', 'refs/heads/production']);

/** Sentinel `selectSpecs` returns instead of a spec list when nothing narrows the run. */
export const FULL_SUITE = 'full';

/**
 * A path under one of these always selects the full suite, never a scoped
 * one: each is read by more than one journey, or changes what every journey
 * runs against, so no spec list can be trusted to cover it.
 */
export const SHARED_PATH_PATTERNS = [
  /^packages\/shared\//,
  /^packages\/db\//,
  /^apps\/api\//,
  /^apps\/web\/src\/components\//,
  /^apps\/web\/src\/lib\//,
  /^apps\/web\/src\/middleware\.ts$/,
  /^apps\/web\/src\/app\/layout\.tsx$/,
  /^apps\/web\/playwright\.config\.ts$/,
  /^\.github\/workflows\/ci\.yml$/,
  /^scripts\/e2e-/,
  /^apps\/web\/e2e\/(fixtures|fixtures-data|base-url|hydration|no-row-account|booking-journey|step-up)\.ts$/,
];

/**
 * Changed-path glob to spec glob: the table `selectSpecs` walks (VEN-411 AC6).
 * Ordered by the surface a careful engineer would name it after, not
 * alphabetically. A path matching none of these is unmapped and, like a
 * shared path, fails safe to the full suite — see `selectSpecs`.
 *
 * A changed path can match more than one entry (`vendor/bookings` is both the
 * `vendor` surface and a page `paid-booking.spec.ts` reads to confirm a
 * payment), so `selectSpecs` unions every match rather than taking the first
 * — this table is a set of overlapping "which specs read this page" facts,
 * not a partition. Built from a `goto(` inventory of `apps/web/e2e/*`, not
 * guessed from route names.
 */
export const SPEC_SELECTORS = [
  {
    label: 'admin',
    paths: [/^apps\/web\/src\/app\/admin\//, /^apps\/web\/e2e\/admin-/],
    specs: [
      'admin-closed-customers.spec.ts',
      'admin-detail-patterns.spec.ts',
      'admin-filters.spec.ts',
      'admin-lists.spec.ts',
      'admin-operator-closure.spec.ts',
      // /admin/settings toggles the checkout pause and the vendor invite gate.
      'launch-switches.spec.ts',
      'vendor-refusal-routing.spec.ts',
    ],
  },
  {
    label: 'auth',
    paths: [
      /^apps\/web\/src\/app\/(sign-in|sign-up|forgot-password|reset-password|after-sign-in)\//,
      /^apps\/web\/src\/app\/api\/auth\//,
      /^apps\/web\/src\/app\/api\/session\//,
    ],
    specs: ['auth.spec.ts', 'focus-indicator.spec.ts'],
  },
  {
    label: 'accept-terms',
    paths: [/^apps\/web\/src\/app\/accept-terms\//],
    specs: ['accept-terms-console.spec.ts'],
  },
  {
    label: 'booking',
    // The hub and the `[requestId]` pay/checkout/confirmed pages read
    // separately below — this is the hub and anything not more specifically
    // matched there, unioned in when a path matches both.
    paths: [
      /^apps\/web\/src\/app\/bookings\//,
      /^apps\/web\/src\/app\/vendors\/\[slug\]\/request\//,
    ],
    specs: ['booking-request.spec.ts', 'focus-indicator.spec.ts', 'admin-detail-patterns.spec.ts'],
  },
  {
    label: 'payments',
    paths: [
      /^apps\/web\/src\/app\/bookings\/\[requestId\]\//,
      /^apps\/web\/src\/app\/vendor\/payments\//,
    ],
    specs: ['paid-booking.spec.ts', 'launch-switches.spec.ts'],
  },
  {
    label: 'messaging',
    paths: [/^apps\/web\/src\/app\/messages\//],
    specs: ['messaging.spec.ts', 'focus-indicator.spec.ts'],
  },
  {
    label: 'vendor',
    paths: [
      /^apps\/web\/src\/app\/vendor\//,
      /^apps\/web\/src\/app\/sign-up\/vendor-details\//,
      /^apps\/web\/src\/app\/vendors\/apply\//,
      /^apps\/web\/src\/app\/suspended\//,
    ],
    specs: [
      'vendor-refusal-routing.spec.ts',
      'focus-indicator.spec.ts',
      'paid-booking.spec.ts',
      'booking-request.spec.ts',
      'image-fallback.spec.ts',
    ],
  },
  {
    label: 'vendor-profile',
    // The public `/vendors/[slug]` storefront, distinct from `vendors/apply`.
    paths: [/^apps\/web\/src\/app\/vendors\/\[slug\]\//],
    specs: [
      'booking-request.spec.ts',
      'messaging.spec.ts',
      'paid-booking.spec.ts',
      'focus-indicator.spec.ts',
    ],
  },
  {
    label: 'customer',
    paths: [/^apps\/web\/src\/app\/customer\//],
    specs: ['focus-indicator.spec.ts'],
  },
  {
    label: 'search',
    paths: [/^apps\/web\/src\/app\/search\//],
    specs: ['focus-indicator.spec.ts'],
  },
  {
    label: 'home',
    paths: [/^apps\/web\/src\/app\/page\.tsx$/],
    specs: ['body-text-size.spec.ts', 'image-fallback.spec.ts'],
  },
  {
    label: 'landing',
    paths: [/^apps\/web\/src\/app\/for-vendors\//, /^apps\/web\/src\/app\/waitlist\//],
    specs: ['route-landing.spec.ts'],
  },
];

/**
 * `route-landing.spec.ts` does not read one page — it walks every route
 * `route-targets.ts` finds under `apps/web/src/app` at run time (that is the
 * point of it: a route added today is covered with nothing edited here). So
 * it runs whenever a matched path adds or changes a route, on top of
 * whichever spec that route's own table entry names.
 */
const ROUTE_SWEEP_SPEC = 'route-landing.spec.ts';
const ROUTE_SWEEP_PATH = /^apps\/web\/src\/app\//;

/**
 * Which specs this diff, on this trigger, needs to run (VEN-411 AC6-9).
 *
 * `ref` is `GITHUB_REF` as GitHub Actions sets it (`refs/heads/<branch>` for a
 * push, `refs/pull/<n>/merge` for a pull request). `changedPaths` are
 * repo-relative paths from the merge-base diff.
 *
 * Returns `{ suite: FULL_SUITE, reason }` or `{ suite: string[], reason }`,
 * where the list is deduplicated spec filenames (empty when nothing is
 * affected) and `reason` is a short, human-readable justification for the
 * summary line.
 */
export function selectSpecs({ ref, changedPaths }) {
  if (FULL_SUITE_REFS.has(ref)) {
    return { suite: FULL_SUITE, reason: `push to ${ref}: the full suite is the release gate` };
  }

  if (changedPaths.length === 0) {
    return { suite: [], reason: 'no changed paths' };
  }

  const specs = new Set();
  for (const path of changedPaths) {
    const ownSpec = path.match(/^apps\/web\/e2e\/([^/]+\.spec\.ts)$/)?.[1];
    if (ownSpec) {
      specs.add(ownSpec);
      continue;
    }

    if (SHARED_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
      return { suite: FULL_SUITE, reason: `${path} is a shared path` };
    }

    const matches = SPEC_SELECTORS.filter(({ paths }) =>
      paths.some((pattern) => pattern.test(path)),
    );
    if (matches.length === 0) {
      return { suite: FULL_SUITE, reason: `${path} matches no entry in the changed-path table` };
    }

    for (const { specs: matchSpecs } of matches) {
      for (const spec of matchSpecs) specs.add(spec);
    }
    if (ROUTE_SWEEP_PATH.test(path)) specs.add(ROUTE_SWEEP_SPEC);
  }

  return { suite: [...specs], reason: null };
}

/** The `select` command's `GITHUB_OUTPUT` lines: which suite, and which specs if scoped. */
function selectionOutputs(selection) {
  if (selection.suite === FULL_SUITE) return { suite: 'full', specs: '' };
  if (selection.suite.length === 0) return { suite: 'none', specs: '' };
  return { suite: 'scoped', specs: selection.suite.join(',') };
}

/** The `select` command's job-summary line — never a skipped required check. */
export function renderSelection(selection) {
  if (selection.suite === FULL_SUITE) {
    return `### End-to-end journeys\n\nFull suite — ${selection.reason}.\n`;
  }
  if (selection.suite.length === 0) {
    return '### End-to-end journeys\n\nno journeys affected by this diff\n';
  }
  return `### End-to-end journeys\n\nScoped to: ${selection.suite.join(', ')}\n`;
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

  if (command === 'select' && reportPath) {
    const changedPaths = readFileSync(reportPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const selection = selectSpecs({ ref: env.GITHUB_REF ?? '', changedPaths });
    const outputs = selectionOutputs(selection);
    append(env.GITHUB_OUTPUT, `suite=${outputs.suite}\n`);
    append(env.GITHUB_OUTPUT, `specs=${outputs.specs}\n`);
    const text = renderSelection(selection);
    append(env.GITHUB_STEP_SUMMARY, text);
    process.stdout.write(text);
    return 0;
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

  process.stderr.write(
    'usage: e2e-ci.mjs secrets | select <changed-files.txt> | summary <playwright-report.json>\n',
  );
  return 64;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
