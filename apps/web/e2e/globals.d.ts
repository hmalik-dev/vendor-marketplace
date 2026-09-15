/**
 * The slice of Clerk's browser global the suites read.
 *
 * Only what the suites need: whether the client has finished loading, whether
 * it holds a user, and a session token for setting preconditions up through the
 * API. Typing the whole SDK surface here would drift from the real one without
 * anything catching it.
 */
declare global {
  interface Window {
    Clerk?: {
      loaded?: boolean;
      user?: { id: string } | null;
      session?: { getToken: () => Promise<string | null> } | null;
    };
  }
}

export {};
