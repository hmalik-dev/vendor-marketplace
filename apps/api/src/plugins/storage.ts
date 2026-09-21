import fp from 'fastify-plugin';
import type { ObjectStorage } from '../lib/storage.js';

declare module 'fastify' {
  interface FastifyInstance {
    storage: ObjectStorage;
    /** The configured public base of stored objects; the only origin an absolute image URL may name. */
    storagePublicUrl: string;
  }
}

export interface StoragePluginOptions {
  storage: ObjectStorage;
  publicUrl: string;
}

/**
 * Decorates the instance with the object storage adapter. Like the database
 * handle, it is constructed by the caller so the route suites can swap in an
 * in-memory recorder without reaching S3.
 */
export const storagePlugin = fp<StoragePluginOptions>(
  async (app, options) => {
    app.decorate('storage', options.storage);
    app.decorate('storagePublicUrl', options.publicUrl);
  },
  { name: 'storage' },
);
