import { disableZodJit } from './zod-jitless';

/*
 * A side-effect module, so it can be the *first* import of the client entry.
 * Zod decides whether to compile a validator when a schema is constructed, not
 * when it parses, and `@vendor-marketplace/shared` builds its schemas at import
 * time: calling `disableZodJit()` from the entry's own body runs after every
 * import has already evaluated and the probe has already fired (VEN-523).
 */
disableZodJit();
