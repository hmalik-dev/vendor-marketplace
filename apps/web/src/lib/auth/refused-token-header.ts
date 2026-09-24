/**
 * Names the token the API refused (VEN-717), so `/api/session/token` mints a
 * new one instead of serving its cache. Its own module because the route and the
 * browser client both need it and the client registers a browser-only handler on
 * import, which must not run in the server process.
 */
export const REFUSED_TOKEN_HEADER = 'x-refused-token';
