/**
 * Detection rules for the secret scanner.
 *
 * The rules are deliberately weighted towards provider-issued token shapes
 * rather than generic entropy. A scanner that cries wolf gets bypassed with
 * `--no-verify` within a week, at which point it protects nothing — so a rule
 * earns its place only if a match is almost certainly a real credential.
 */

/** A file that must never be committed, whatever its contents. */
export interface ForbiddenPath {
  readonly label: string;
  readonly test: (path: string) => boolean;
}

export interface SecretRule {
  readonly id: string;
  readonly label: string;
  readonly pattern: RegExp;
  /** Extra narrowing for rules a regex alone cannot decide. */
  readonly confirm?: (match: RegExpExecArray) => boolean;
}

/**
 * Skipping the pragma check for these means the scanner cannot be silenced by
 * a value that merely looks like a placeholder.
 */
const PLACEHOLDER =
  /^(x+|\.{3}|<.*>|change[-_]?me|placeholder|your[-_].*|dummy|example|redacted|test)$/i;

/** Shannon entropy in bits per character. */
export function entropy(value: string): number {
  if (value.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const char of value) {
    counts.set(char, (counts.get(char) ?? 0) + 1);
  }

  let bits = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/**
 * `.env` is the file the near-miss actually involved: a backup of a filled-in
 * `.env` was stageable because `.gitignore` listed only three exact variants.
 * `.gitignore` is now `.env.*`, and this is the belt to that suspenders — an
 * ignore rule stops an accidental `git add`, not a deliberate `git add -f`.
 */
export const FORBIDDEN_PATHS: readonly ForbiddenPath[] = [
  {
    label: 'environment file (only .env.example may be committed)',
    test: (path) => {
      const name = path.split('/').pop() ?? '';
      return name === '.env' || (name.startsWith('.env') && name !== '.env.example');
    },
  },
  {
    label: 'private key file',
    test: (path) =>
      /\.(pem|key|p12|pfx|jks|keystore)$/i.test(path) ||
      /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/.test(path),
  },
  {
    /*
     * `.npmrc` is deliberately absent: this repository commits one, and so do
     * most, to carry registry settings. It is dangerous only when it carries an
     * auth token, which the `npm-auth-token` content rule catches instead.
     */
    label: 'credential store',
    test: (path) => /(^|\/)\.(netrc|pgpass)$/.test(path) || /(^|\/)credentials$/.test(path),
  },
];

/**
 * Literal values that look exactly like credentials because they are meant to —
 * they are the fixtures the env-shape suites assert against. Listing them here
 * rather than sprinkling `secret-scan:allow` through four files keeps the
 * exceptions in one reviewable place: adding a real key to this set is a
 * conspicuous act in a diff, which is the property that matters.
 */
export const KNOWN_FIXTURES: ReadonlySet<string> = new Set([
  'sk_test_51ABCdefGHIjklMNO',
  'sk_test_51ABCdefGHIjklMNOpqr',
  'sk_live_51ABCdefGHIjklMNO',
  'whsec_MfKQ9r8sTuVwXyZ0123456789',
]);

export const SECRET_RULES: readonly SecretRule[] = [
  {
    id: 'private-key',
    label: 'private key block',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    id: 'stripe-live',
    label: 'Stripe live key',
    pattern: /\b(?:sk|rk)_live_[A-Za-z0-9]{10,}/g,
  },
  {
    id: 'stripe-test',
    label: 'Stripe/Clerk test key with real entropy',
    // `sk_test_ci_placeholder` stops at `ci` — underscores are not in the class,
    // so declared placeholders never reach the length threshold.
    pattern: /\b(?:sk|rk)_test_[A-Za-z0-9]{16,}/g,
  },
  {
    id: 'clerk-live',
    label: 'Clerk live key',
    pattern: /\bpk_live_[A-Za-z0-9]{10,}/g,
  },
  {
    id: 'svix-secret',
    label: 'svix/Clerk webhook signing secret',
    pattern: /\bwhsec_[A-Za-z0-9+/=]{16,}/g,
  },
  {
    id: 'neon-password',
    label: 'Neon database password',
    pattern: /\bnpg_[A-Za-z0-9]{12,}/g,
  },
  {
    id: 'aws-access-key',
    label: 'AWS access key id',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    id: 'github-token',
    label: 'GitHub token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})/g,
  },
  {
    id: 'slack-token',
    label: 'Slack token',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
  },
  {
    id: 'google-api-key',
    label: 'Google API key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    id: 'npm-auth-token',
    label: 'npm registry auth token',
    pattern: /_(?:authToken|password)\s*=\s*\S{8,}/g,
  },
  {
    id: 'remote-db-url',
    label: 'database URL with an embedded password',
    /*
     * Local fixtures are the overwhelming majority of connection strings in a
     * repository, and every one of them points at localhost. Keying on the
     * host rather than on the password's shape is what lets this rule stay on
     * without drowning the checkout's own test data.
     */
    pattern:
      /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:/@]+:([^\s@]+)@([^\s/:]+)/g,
    confirm: (match) => {
      const password = match[1] ?? '';
      const host = match[2] ?? '';
      const isLocal =
        /^(localhost|127\.0\.0\.1|::1|host\.docker\.internal|postgres|db|storage)$/i.test(host);
      return !isLocal && !PLACEHOLDER.test(password) && password.length >= 8;
    },
  },
  {
    id: 'generic-assignment',
    label: 'high-entropy value assigned to a secret-named key',
    pattern:
      /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|APIKEY|API_KEY|PRIVATE_KEY|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*['"]?([A-Za-z0-9+/_=-]{24,})['"]?/g,
    confirm: (match) => {
      const value = match[2] ?? '';
      if (PLACEHOLDER.test(value)) return false;
      // `vendor_marketplace_dev`-style words are long but not random.
      if (/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(value)) return false;
      return entropy(value) >= 3.5;
    },
  },
];
