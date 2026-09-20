import { findVariable, isLoopbackHost, shapeFor } from '@vendor-marketplace/shared/env';
import { hostOf } from '../checks/database.js';
import {
  failed,
  judge,
  passed,
  type LaunchOptions,
  type LaunchResult,
  type Probe,
} from './types.js';

const NON_PLACEHOLDER_KEYS = ['SENTRY_DSN', 'OPERATOR_ALERT_EMAIL', 'SUPPORT_EMAIL_TO'] as const;
/**
 * Requests per minute per IP. Below the floor a page load that fans out to a
 * dozen API calls trips it; above the ceiling it no longer limits anything.
 */
const RATE_LIMIT_BAND = { min: 30, max: 1000 } as const;

const R2_HOST = /\.r2\.(dev|cloudflarestorage\.com)$/i;

function storageResult(env: NodeJS.ProcessEnv): LaunchResult {
  const name = 'STORAGE_PUBLIC_URL';
  const value = env.STORAGE_PUBLIC_URL?.trim();
  const host = hostOf(value);

  if (!value || !host) {
    return failed('storage', name, value ? `${value} is not a URL` : 'unset');
  }
  if (R2_HOST.test(host)) {
    return failed(
      'storage',
      name,
      `${value} is an R2 host (uploads are stored on Neon Object Storage)`,
    );
  }
  if (isLoopbackHost(host)) {
    return failed('storage', name, `${value} is a local address (expected the Neon storage host)`);
  }

  const endpoint = env.STORAGE_ENDPOINT?.trim();
  if (endpoint && R2_HOST.test(hostOf(endpoint) ?? '')) {
    return failed(
      'storage',
      name,
      `STORAGE_ENDPOINT ${endpoint} is an R2 host (writes would miss the Neon bucket)`,
    );
  }

  return passed('storage', name, value);
}

/**
 * Printed values are the registry's own placeholders, never what the operator
 * set. A registry default is not refused: `support@<BRAND_DOMAIN>` can be the
 * real monitored address, and production must only state it.
 */
function nonPlaceholderResult(env: NodeJS.ProcessEnv, key: string): LaunchResult {
  const variable = findVariable(key);
  const value = env[key]?.trim();

  if (!value) {
    return failed('env', key, 'unset');
  }
  if (value === variable?.placeholder) {
    return failed('env', key, `still the placeholder ${value}`);
  }

  const shape = variable ? shapeFor(variable, 'production') : undefined;
  return shape && !shape.test(value)
    ? failed('env', key, 'set, but does not match its production shape')
    : passed('env', key, 'set');
}

function rateLimitResult(env: NodeJS.ProcessEnv): LaunchResult {
  const name = 'RATE_LIMIT_MAX';
  const raw = env.RATE_LIMIT_MAX?.trim() || findVariable(name)?.defaultValue || '';

  if (!/^\d+$/.test(raw)) {
    return failed('env', name, `${raw || 'unset'} is not a whole number`);
  }

  const limit = Number(raw);
  return judge(
    'env',
    name,
    raw,
    limit >= RATE_LIMIT_BAND.min && limit <= RATE_LIMIT_BAND.max,
    `${RATE_LIMIT_BAND.min}–${RATE_LIMIT_BAND.max}`,
  );
}

export function configProbes({ env }: LaunchOptions): Probe[] {
  return [
    { group: 'storage', name: 'STORAGE_PUBLIC_URL', run: async () => [storageResult(env)] },
    {
      group: 'env',
      name: 'environment',
      run: async () => [
        ...NON_PLACEHOLDER_KEYS.map((key) => nonPlaceholderResult(env, key)),
        rateLimitResult(env),
      ],
    },
  ];
}
