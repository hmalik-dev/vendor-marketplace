import { join } from 'node:path';

import { resolveE2EBaseUrl } from './base-url.js';
import { optimizerWarmupPaths, warmImageOptimizer } from './warm-image-optimizer.js';

/** Runs once, before the first spec — see `warm-image-optimizer.ts` for why. */
export default async function globalSetup(): Promise<void> {
  await warmImageOptimizer(resolveE2EBaseUrl(), optimizerWarmupPaths(join(__dirname, '../public')));
}
