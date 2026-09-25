import { loadEnv } from '../load-env.js';
import { runResetCli } from './reset.js';

/** `pnpm db:reset`; see `reset.ts` for the flags and `docs/environments.md` for the runbook. */
loadEnv();

process.exitCode = await runResetCli(process.argv.slice(2), process.env, {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
});
