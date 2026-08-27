import { readFileSync } from 'node:fs';
import path from 'node:path';
import { COMPOSE_SERVICES, type Capability } from '@vendor-marketplace/shared/env';
import { runCommand } from '../exec.js';
import { type Check, type CheckContext, type CheckResult, fail, pass } from '../types.js';

/**
 * Fallback only. The real floor is `engines.node` in the root `package.json`,
 * which is the one number CI, `.nvmrc` and the API image all answer to — see
 * `toolchain.test.ts`, which fails if any of them drifts below it.
 */
const FALLBACK_NODE_MAJOR = 22;

/** `">=22.22.2"` -> `22`. A range this cannot read falls back rather than passing everything. */
export function requiredNodeMajor(engineRange: string | undefined): number {
  const match = /(\d+)/.exec(engineRange ?? '');
  const parsed = match ? Number.parseInt(match[1] ?? '', 10) : Number.NaN;

  return Number.isNaN(parsed) ? FALLBACK_NODE_MAJOR : parsed;
}

interface RootManifest {
  readonly packageManager?: string;
  readonly engines?: { readonly node?: string };
}

function readRootManifest(repoRoot: string): RootManifest {
  try {
    return JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as RootManifest;
  } catch {
    return {};
  }
}

function checkNode(repoRoot: string): CheckResult {
  const required = requiredNodeMajor(readRootManifest(repoRoot).engines?.node);
  const [major] = process.versions.node.split('.');
  const parsed = Number.parseInt(major ?? '', 10);

  if (Number.isNaN(parsed) || parsed < required) {
    return fail(
      'core',
      `Node >= ${required}`,
      `running Node ${process.versions.node}`,
      `nvm install ${required} && nvm use ${required}`,
    );
  }

  return pass('core', `Node >= ${required}`, `v${process.versions.node}`);
}

async function checkPnpm(repoRoot: string): Promise<CheckResult> {
  const declared = readRootManifest(repoRoot).packageManager;
  const expected = declared?.startsWith('pnpm@') ? declared.slice('pnpm@'.length) : undefined;

  if (!expected) {
    return fail(
      'core',
      'pnpm matches packageManager',
      'package.json declares no pnpm packageManager',
      'Add "packageManager": "pnpm@<version>" to the root package.json',
    );
  }

  const outcome = await runCommand('pnpm', ['--version']);

  if (outcome.status === 'missing') {
    return fail('core', 'pnpm matches packageManager', 'pnpm is not installed', 'corepack enable');
  }

  if (outcome.status === 'failed') {
    return fail(
      'core',
      'pnpm matches packageManager',
      outcome.stderr || 'pnpm --version failed',
      'corepack enable',
    );
  }

  if (outcome.stdout !== expected) {
    return fail(
      'core',
      'pnpm matches packageManager',
      `running ${outcome.stdout}, package.json pins ${expected}`,
      `corepack prepare pnpm@${expected} --activate`,
    );
  }

  return pass('core', 'pnpm matches packageManager', outcome.stdout);
}

/** Capabilities in play that are backed by a `docker-compose.yml` service. */
export function composeServicesFor(capabilities: Iterable<Capability>): string[] {
  const services: string[] = [];

  for (const capability of capabilities) {
    const service = COMPOSE_SERVICES[capability];

    if (service) {
      services.push(service);
    }
  }

  return services;
}

async function checkDocker(context: CheckContext): Promise<CheckResult[]> {
  const services = composeServicesFor(context.capabilities);

  if (services.length === 0 || context.target === 'production') {
    return [];
  }

  const name = 'Docker is running';
  const outcome = await runCommand('docker', ['info', '--format', '{{.ServerVersion}}']);

  if (outcome.status === 'missing') {
    return [
      fail(
        'core',
        name,
        'Docker is not installed',
        'Install Docker Desktop: https://docs.docker.com/desktop/',
      ),
    ];
  }

  if (outcome.status === 'failed') {
    return [
      fail(
        'core',
        name,
        'Docker is installed but the daemon is not responding',
        `open -a Docker && docker compose up -d ${services.join(' ')}`,
      ),
    ];
  }

  return [pass('core', name, `engine ${outcome.stdout}`)];
}

export const toolchainCheck: Check = {
  id: 1,
  title: 'Toolchain',
  async run(context) {
    return [
      checkNode(context.repoRoot),
      await checkPnpm(context.repoRoot),
      ...(await checkDocker(context)),
    ];
  },
};
