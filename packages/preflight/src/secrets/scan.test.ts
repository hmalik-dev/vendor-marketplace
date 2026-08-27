// secret-scan:allow-file — this suite exists to hold credential shapes.
import { describe, expect, it } from 'vitest';
import { entropy } from './patterns.js';
import { redact, scanFile, scanFiles } from './scan.js';

/*
 * Credential-shaped fixtures are assembled at run time rather than written as
 * literals. The strings the scanner sees are identical, but the source file
 * contains no token that GitHub's push protection — or any other scanner
 * pointed at this repository — would flag. A secret scanner's own test corpus
 * is the one place where that collision is guaranteed, and a blocked push is
 * a bad way to discover it.
 */
const token = (...parts: readonly string[]) => parts.join('_');
const dashed = (...parts: readonly string[]) => parts.join('-');

const STRIPE_LIVE = token('sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc');
const STRIPE_TEST = token('sk', 'test', '9QmZp0RvT7bNw4LcYdF1sHgU');
const CLERK_LIVE = token('pk', 'live', 'Y2xlcmsuZXhhbXBsZS5jb20k');
const SVIX = token('whsec', '9QmZp0RvT7bNw4LcYdF1sHgU');
const NEON = token('npg', 'x5UGZF0yfaktEXAMPLE');
const GITHUB_TOKEN = token('ghp', '1234567890abcdefghijABCDEFGHIJ');
const SLACK = dashed('xoxb', '1234567890', 'abcdefghijkl');
const AWS_KEY = `AKIA${'IOSFODNN7EXAMPLE'}`;
const NPM_TOKEN = token('npm', '9QmZp0RvT7bNw4LcYdF1sHgU');

const scan = (path: string, content: string) => scanFile({ path, content });
const rules = (path: string, content: string) => scan(path, content).map((f) => f.rule);

describe('forbidden paths', () => {
  it.each(['.env', '.env.local', '.env.bak-rename', '.env.production', 'apps/api/.env.save'])(
    'refuses to let %s be committed',
    (path) => {
      expect(rules(path, 'anything')).toEqual(['forbidden-path']);
    },
  );

  it('allows the generated .env.example', () => {
    expect(scan('.env.example', `CLERK_SECRET_KEY=${token('sk', 'test', '...')}`)).toEqual([]);
  });

  it.each(['certs/server.pem', 'deploy/id_rsa', 'app.key', '.netrc', '.pgpass'])(
    'refuses %s',
    (path) => {
      expect(rules(path, 'x')).toEqual(['forbidden-path']);
    },
  );

  /*
   * This repository commits a `.npmrc`, and most do — it carries registry
   * settings. Banning it by name made the scanner fail on a clean checkout,
   * so the danger is located in the contents instead.
   */
  it('allows a .npmrc that only carries registry settings', () => {
    expect(scan('.npmrc', 'auto-install-peers=true\nstrict-peer-dependencies=false')).toEqual([]);
  });

  it('flags a .npmrc carrying an auth token', () => {
    expect(rules('.npmrc', `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`)).toContain(
      'npm-auth-token',
    );
  });

  it('reports the file itself rather than a line', () => {
    const [finding] = scan('.env', 'DATABASE_URL=postgres://a:b@example.com/db');

    expect(finding).toMatchObject({ line: 0, rule: 'forbidden-path' });
  });
});

describe('provider token rules', () => {
  it('catches the Neon password that the near-miss exposed', () => {
    expect(rules('config.ts', `const url = '${NEON}';`)).toContain('neon-password');
  });

  it.each([
    ['stripe-live', `key = '${STRIPE_LIVE}'`],
    ['clerk-live', `key = '${CLERK_LIVE}'`],
    ['svix-secret', `secret = '${SVIX}'`],
    ['aws-access-key', `id = "${AWS_KEY}"`],
    ['github-token', `tok = "${GITHUB_TOKEN}"`],
    ['slack-token', `tok = "${SLACK}"`],
    ['private-key', '-----BEGIN RSA PRIVATE KEY-----'],
  ])('catches %s', (rule, content) => {
    expect(rules('src/thing.ts', content)).toContain(rule);
  });

  it('does not fire on the CI workflow placeholders', () => {
    const workflow = [
      `CLERK_SECRET_KEY: ${token('sk', 'test', 'ci', 'placeholder')}`,
      `CLERK_WEBHOOK_SECRET: ${token('whsec', 'ci', 'placeholder')}`,
      `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${token('pk', 'test', 'Y2kuY2xlcmsuYWNjb3VudHMuZGV2JA')}`,
    ].join('\n');

    expect(scan('.github/workflows/ci.yml', workflow)).toEqual([]);
  });
});

describe('database URLs', () => {
  it('ignores the local fixtures the repository is full of', () => {
    const local = [
      "'postgresql://vendor_marketplace:vendor_marketplace_dev@localhost:5432/vendor_marketplace'",
      "'postgres://user:pw@127.0.0.1/db'",
      "'postgres://user:pw@host.docker.internal:9000/db'",
    ].join('\n');

    expect(scan('src/fixtures.ts', local)).toEqual([]);
  });

  it('flags a remote host with a real password', () => {
    const remote = `DATABASE_URL=postgresql://neondb_owner:${token(
      'npg',
      'SomeRealLooking1',
    )}@ep-lucky.aws.neon.tech/neondb`;

    expect(rules('notes.md', remote)).toContain('remote-db-url');
  });

  it('ignores a remote URL whose password is obviously a placeholder', () => {
    expect(rules('docs.md', 'postgresql://user:changeme@db.example.com/app')).not.toContain(
      'remote-db-url',
    );
  });
});

describe('generic secret-named assignments', () => {
  it('flags a high-entropy value', () => {
    expect(rules('a.ts', "API_TOKEN = 'k3J8xQ2mZp0RvT7bNw4LcYdF1sHgUe'")).toContain(
      'generic-assignment',
    );
  });

  it('ignores a long but word-shaped local value', () => {
    expect(rules('a.ts', "S3_SECRET_ACCESS_KEY = 'vendor_marketplace_dev_password'")).toEqual([]);
  });

  it('ignores declared placeholders', () => {
    expect(rules('a.ts', "MY_SECRET = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx'")).toEqual([]);
  });
});

describe('known fixtures', () => {
  it('exempts the literals the env-shape suites assert against', () => {
    const fixtures = [
      `CLERK_SECRET_KEY: '${token('sk', 'test', '51ABCdefGHIjklMNOpqr')}'`,
      `STRIPE_SECRET_KEY: '${token('sk', 'test', '51ABCdefGHIjklMNO')}'`,
      `CLERK_WEBHOOK_SECRET: '${token('whsec', 'MfKQ9r8sTuVwXyZ0123456789')}'`,
    ].join('\n');

    expect(scan('src/env.test.ts', fixtures)).toEqual([]);
  });

  it('still flags a near-miss variant of an allowlisted fixture', () => {
    expect(rules('a.ts', `k = '${token('sk', 'live', '51ABCdefGHIjklMNOpqrSTU')}'`)).toContain(
      'stripe-live',
    );
  });
});

describe('pragmas', () => {
  const line = `const fixture = '${STRIPE_TEST}';`;

  it('fires without one', () => {
    expect(rules('t.ts', line)).toContain('stripe-test');
  });

  it('is silenced on the same line', () => {
    expect(scan('t.ts', `${line} // secret-scan:allow`)).toEqual([]);
  });

  it('is silenced by the line above', () => {
    expect(scan('t.ts', `// secret-scan:allow\n${line}`)).toEqual([]);
  });

  it('is silenced for a whole file', () => {
    expect(scan('t.ts', `// secret-scan:allow-file\n${line}\n${line}`)).toEqual([]);
  });
});

describe('reporting', () => {
  it('never reprints the whole credential', () => {
    const secret = NEON;
    const [finding] = scan('a.ts', `const x = '${secret}';`);

    expect(finding?.excerpt).not.toContain(secret);
    expect(finding?.excerpt).toContain('npg_x5');
    expect(finding?.excerpt).toContain('23 chars');
  });

  it('reveals at most a third of a short match, and never the tail', () => {
    expect(redact('abcdefgh')).toBe('ab… (8 chars)');
  });

  it('never reveals more than six characters, however long the match', () => {
    const long = token('sk', 'live', 'a'.repeat(90));

    expect(redact(long)).toBe('sk_liv… (98 chars)');
  });

  it('reports the 1-indexed line', () => {
    const [finding] = scan('a.ts', `one\ntwo\nconst k = '${AWS_KEY}';`);

    expect(finding?.line).toBe(3);
  });

  it('scans every file independently, without regex state leaking between them', () => {
    const found = scanFiles([
      { path: 'a.ts', content: `k = '${AWS_KEY}'` },
      { path: 'b.ts', content: `k = '${AWS_KEY}'` },
    ]);

    expect(found.map((f) => f.path)).toEqual(['a.ts', 'b.ts']);
  });

  it('skips binary content', () => {
    expect(scan('logo.png', `PNG\u0000\u0000${STRIPE_LIVE}`)).toEqual([]);
  });
});

describe('entropy', () => {
  it('is zero for a single repeated character', () => {
    expect(entropy('aaaaaaaa')).toBe(0);
  });

  it('rises with character variety', () => {
    expect(entropy('k3J8xQ2mZp0RvT7b')).toBeGreaterThan(entropy('aaaabbbbccccdddd'));
  });

  it('is zero for the empty string', () => {
    expect(entropy('')).toBe(0);
  });
});
