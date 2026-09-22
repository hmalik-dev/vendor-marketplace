import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Reads the six-digit Neon Auth code Mailosaur received for `address`, via the
 * one reviewed command (VEN-561) — never the mailbox key directly.
 *
 * Runs the root `pnpm e2e:mail-code <address>` as a subprocess — the exact
 * command the account holder's allow rule names — so the account holder's
 * allow rule for it covers this spec too; the command itself loads
 * `E2E_MAIL_API_KEY` and `E2E_MAIL_SERVER` from `.env.e2e.local` and never
 * accepts them as arguments, so neither reaches this process or its output.
 * `-w` runs that root script from wherever this process's cwd sits inside the
 * workspace, which avoids resolving the repo root by hand — Playwright
 * transpiles specs to CJS (see `apps/web/e2e/README.md`), where `import.meta`
 * is a syntax error.
 */
export async function readStagingMailCode(address: string): Promise<string> {
  // `--silent` on the outer invocation too: the root script is already
  // silent about the *inner* pnpm call, but without this the outer one still
  // prints its own "> vendor-marketplace@… e2e:mail-code …" header onto
  // stdout ahead of the code, which fails the six-digit check below on every
  // run.
  const { stdout } = await execFileAsync('pnpm', ['--silent', '-w', 'e2e:mail-code', address], {
    timeout: 90_000,
  });

  const code = stdout.trim();

  if (!/^\d{6}$/.test(code)) {
    throw new Error(`e2e:mail-code did not print a six-digit code for ${address}`);
  }

  return code;
}
