import fp from 'fastify-plugin';
import { createNeonAuthDirectory, type NeonAuthDirectory } from '@vendor-marketplace/db';

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Reads and ends Neon Auth identities outside a session, or `null` when this
     * deployment has no connection to the branch's `neon_auth` schema.
     *
     * `null` is a real state, not an error: a lane's database is a local Docker
     * Postgres while its identities live on a Neon branch, and there
     * `NEON_AUTH_DATABASE_URL` is unset on purpose. A caller must then say so —
     * a closure reports `identityDeleted: false` and the console asks for a
     * person — rather than pretend an identity ended that did not.
     */
    authDirectory: NeonAuthDirectory | null;
  }
}

export interface AuthDirectoryPluginOptions {
  connectionString: string | undefined;
  /** Overridden by the route suites so they never reach Neon's network. */
  directory?: NeonAuthDirectory;
}

export const authDirectoryPlugin = fp<AuthDirectoryPluginOptions>(
  async (app, options) => {
    const directory =
      options.directory ??
      (options.connectionString === undefined
        ? null
        : createNeonAuthDirectory(options.connectionString));

    app.decorate('authDirectory', directory);

    if (directory !== null) {
      app.addHook('onClose', async () => {
        await directory.close();
      });
    }
  },
  { name: 'auth-directory' },
);
