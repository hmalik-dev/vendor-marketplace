/*
 * `server-only` throws when it is imported without Next's `react-server`
 * condition, which is exactly how Vitest imports a module. Next enforces the
 * fence at build time; a unit test of a fenced module imports it on purpose.
 */
export {};
