import { parseHolders } from '../checks/ports.js';
import { runCommand } from '../exec.js';

export const WEB_BASE = 3000;
export const API_BASE = 4000;

/**
 * Both ports move together on one offset, so `NEXT_PUBLIC_API_URL` is always
 * derivable from the lane's own offset. Forty is far above the five-lane
 * ceiling; exhausting it means lanes are leaking, which should be loud.
 */
export const MAX_OFFSET = 40;

/**
 * FNV-1a, 32-bit. Stable across processes and Node versions, so a lane's ports
 * are reproducible across restarts.
 */
export function stableHash(value: string): number {
  let hash = 0x81_1c_9d_c5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01_00_01_93) >>> 0;
  }

  return hash >>> 0;
}

/** The deterministic first guess for a ticket's lane offset. */
export function firstOffset(ticket: string): number {
  return (stableHash(ticket) % MAX_OFFSET) + 1;
}

export type PortProbe = (port: number) => Promise<boolean>;

export async function isPortFree(port: number): Promise<boolean> {
  const outcome = await runCommand('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-F', 'cp']);

  // Without lsof the port cannot be inspected. Treat it as free and let the
  // server fail loudly on EADDRINUSE rather than blocking the lane here.
  if (outcome.status === 'missing') {
    return true;
  }

  return parseHolders(outcome.stdout).length === 0;
}

/**
 * Deterministic first guess, then probe upward wrapping within the range.
 * Deterministic to be reproducible; probed to be collision-proof.
 */
export async function allocateOffset(
  ticket: string,
  claimed: ReadonlySet<number>,
  probe: PortProbe = isPortFree,
): Promise<number> {
  const start = firstOffset(ticket);

  for (let step = 0; step < MAX_OFFSET; step += 1) {
    const offset = ((start - 1 + step) % MAX_OFFSET) + 1;

    if (claimed.has(offset)) {
      continue;
    }

    if ((await probe(WEB_BASE + offset)) && (await probe(API_BASE + offset))) {
      return offset;
    }
  }

  throw new Error(
    `All ${MAX_OFFSET} lane offsets are exhausted for ticket ${ticket}. ` +
      'Run /land-lanes — stale lanes are leaking manifests or dev servers.',
  );
}
