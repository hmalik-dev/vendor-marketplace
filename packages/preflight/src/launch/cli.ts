import { ENV_FILES, loadContext, REPO_ROOT } from '../context.js';
import { postgresLaunchDatabase } from './database.js';
import { readOnlyGet } from './http.js';
import { loadHandledStripeEvents, loadSeedMarkers, loadStripeApiVersion } from './repo-modules.js';
import { renderLaunchReport, runLaunchChecks } from './run.js';

/**
 * `pnpm launch:check` — whether production is configured for real users and
 * real money, read from the providers themselves. Read-only: every provider
 * call is a GET and the database session is `READ ONLY`. Run by the admin
 * before a release; it needs production credentials, so never in CI.
 */
const { env, envFileFound } = loadContext({ capabilities: [], target: 'production' });
const source = envFileFound
  ? `${ENV_FILES.production} under the process environment`
  : 'the process environment';

process.stdout.write(`Launch check — reading ${source}\n\n`);

const [handledStripeEvents, stripeApiVersion, markers] = await Promise.all([
  loadHandledStripeEvents(REPO_ROOT),
  loadStripeApiVersion(REPO_ROOT),
  loadSeedMarkers(REPO_ROOT),
]);
const database = env.DATABASE_URL
  ? postgresLaunchDatabase({ connectionString: env.DATABASE_URL, repoRoot: REPO_ROOT, markers })
  : null;

try {
  const results = await runLaunchChecks({
    env,
    get: readOnlyGet(),
    database,
    handledStripeEvents,
    stripeApiVersion,
  });
  const report = renderLaunchReport(results);

  process.stdout.write(`${report.lines.join('\n')}\n`);
  process.exitCode = report.failures > 0 ? 1 : 0;
} finally {
  await database?.close();
}
