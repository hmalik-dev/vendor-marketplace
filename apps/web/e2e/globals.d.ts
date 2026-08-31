/**
 * The slice of Clerk's browser global the suites read.
 *
 * Only what `expectSignedIn` needs: whether the client has finished loading,
 * and whether it holds a user. Typing the whole SDK surface here would drift
 * from the real one without anything catching it.
 */
declare global {
  interface Window {
    Clerk?: {
      loaded?: boolean;
      user?: { id: string } | null;
    };
  }
}

export {};
