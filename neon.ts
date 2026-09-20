import { defineConfig } from '@neon/config/v1';

/**
 * Neon branch config. One public-read bucket holds every uploaded image
 * (vendor cover and profile, portfolio, customer avatar); rows store keys and
 * the API proxies uploads so `sharp` re-encodes them. Provision on `dev` and
 * `staging` with `neon deploy --no-env-pull`; a lane never addresses production.
 */
export default defineConfig({
  buckets: {
    uploads: {
      access: 'public_read',
    },
  },
});
