import fp from 'fastify-plugin';
import type { ErrorReporter } from '../lib/error-reporting.js';
import { sweepOrphanedUploads } from '../modules/uploads/upload-sweep.service.js';

export interface UploadSweepPluginOptions {
  /** How often to sweep, in milliseconds. **`0` disables the timer**, as every suite passes. */
  intervalMs: number;
  /** Report what would be deleted and delete nothing. */
  dryRun: boolean;
  reporter: ErrorReporter;
}

/**
 * Removes uploaded images no row references, on a timer.
 *
 * The same in-process shape as `payoutReleasePlugin`. Overlap across instances
 * is settled by the sweep's advisory lock; the `running` flag only stops a slow
 * sweep queueing ticks behind itself within one process.
 */
export const uploadSweepPlugin = fp<UploadSweepPluginOptions>(
  async (app, options) => {
    if (options.intervalMs <= 0) {
      return;
    }

    let running = false;

    const tick = async (): Promise<void> => {
      if (running) {
        return;
      }

      running = true;

      try {
        await sweepOrphanedUploads(
          { db: app.db, storage: app.storage, log: app.log },
          app.clock(),
          { dryRun: options.dryRun },
        );
      } catch (error) {
        // Logged and swallowed: the next tick repairs it, and a rejection here would end the process.
        app.log.error({ err: error }, 'Upload sweep failed');
        options.reporter.capture(error);
      } finally {
        running = false;
      }
    };

    const timer = setInterval(() => void tick(), options.intervalMs);
    timer.unref();

    app.addHook('onClose', async () => {
      clearInterval(timer);
    });
  },
  { name: 'upload-sweep', dependencies: ['clock', 'database', 'storage'] },
);
