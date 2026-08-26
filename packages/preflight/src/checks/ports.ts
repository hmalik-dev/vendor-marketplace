import { runCommand } from '../exec.js';
import { type Check, type CheckResult, fail, pass } from '../types.js';

/** Ports the dev servers bind, and what runs there. */
export const DEV_PORTS: readonly { readonly port: number; readonly service: string }[] = [
  { port: 3000, service: 'apps/web' },
  { port: 4000, service: 'apps/api' },
];

/** Process names that are this repository's own dev servers rather than a foreign holder. */
const OURS = /^(node|next-server|next|tsx|com\.docke)/;

export interface PortHolder {
  readonly command: string;
  readonly pid: string;
}

/** Parses `lsof -nP -iTCP:<port> -sTCP:LISTEN -F cp` output into its holders. */
export function parseHolders(output: string): PortHolder[] {
  const holders: PortHolder[] = [];
  let pid = '';

  for (const line of output.split('\n')) {
    if (line.startsWith('p')) {
      pid = line.slice(1);
    } else if (line.startsWith('c') && pid) {
      holders.push({ command: line.slice(1), pid });
    }
  }

  return holders;
}

export async function evaluatePort(port: number, service: string): Promise<CheckResult> {
  const name = `Port ${port} is available for ${service}`;
  const outcome = await runCommand('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-F', 'cp']);

  if (outcome.status === 'missing') {
    return pass('core', name, 'lsof is unavailable, so the port was not inspected');
  }

  // lsof exits non-zero with no output when nothing is listening.
  const holders = parseHolders(outcome.stdout);

  if (holders.length === 0) {
    return pass('core', name, 'free');
  }

  const foreign = holders.filter((holder) => !OURS.test(holder.command));

  if (foreign.length > 0) {
    const described = foreign.map((holder) => `${holder.command} (pid ${holder.pid})`).join(', ');

    return fail(
      'core',
      name,
      `held by ${described}`,
      `kill ${foreign.map((holder) => holder.pid).join(' ')}`,
    );
  }

  const described = holders.map((holder) => `${holder.command} (pid ${holder.pid})`).join(', ');

  return pass('core', name, `held by this project's dev server: ${described}`);
}

export const portsCheck: Check = {
  id: 10,
  title: 'Ports',
  async run(context) {
    if (context.target === 'production') {
      return [];
    }

    return Promise.all(DEV_PORTS.map(({ port, service }) => evaluatePort(port, service)));
  },
};
