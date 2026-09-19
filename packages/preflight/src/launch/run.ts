import { appProbes } from './app.js';
import { configProbes } from './config.js';
import { databaseProbes } from './database.js';
import { providerProbes } from './providers.js';
import {
  failed,
  type LaunchGroup,
  type LaunchOptions,
  type LaunchResult,
  type Probe,
} from './types.js';

export type { LaunchOptions } from './types.js';

const GROUP_LABELS: Readonly<Record<LaunchGroup, string>> = {
  auth: 'Neon Auth',
  stripe: 'Stripe',
  resend: 'Resend',
  storage: 'Storage',
  database: 'Database',
  env: 'Environment',
  app: 'App',
};
const STATUS_WIDTH = 'MANUAL'.length;

async function settle(probe: Probe): Promise<LaunchResult[]> {
  try {
    return await probe.run();
  } catch (error: unknown) {
    return [
      failed(probe.group, probe.name, error instanceof Error ? error.message : 'the read failed'),
    ];
  }
}

/**
 * Runs every read in parallel. A provider that is down or refuses the key
 * fails its own lines and nothing else, so one run reports everything.
 */
export async function runLaunchChecks(options: LaunchOptions): Promise<LaunchResult[]> {
  const probes = [
    ...providerProbes(options),
    ...configProbes(options),
    ...databaseProbes(options),
    ...appProbes(options),
  ];

  return (await Promise.all(probes.map(settle))).flat();
}

export function renderLaunchReport(results: readonly LaunchResult[]): {
  lines: string[];
  failures: number;
} {
  const lines: string[] = [];

  for (const [group, label] of Object.entries(GROUP_LABELS)) {
    const inGroup = results.filter((result) => result.group === group);
    if (inGroup.length === 0) {
      continue;
    }

    lines.push(label);
    for (const result of inGroup) {
      lines.push(`  ${result.status.padEnd(STATUS_WIDTH)}  ${result.name}: ${result.detail}`);
    }
    lines.push('');
  }

  const failures = results.filter((result) => result.status === 'FAIL').length;
  lines.push(
    failures === 0
      ? `Ready: ${results.length} checks, none failing. Work through the MANUAL and SKIP lines by hand.`
      : `Not ready: ${failures} of ${results.length} checks failing.`,
  );

  return { lines, failures };
}
