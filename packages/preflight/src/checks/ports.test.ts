import { describe, expect, it } from 'vitest';
import type { Capability } from '@vendor-marketplace/shared/env';
import type { CheckContext } from '../types.js';
import { devPorts, parseHolders, portsCheck } from './ports.js';

describe('parseHolders', () => {
  it('pairs each pid with its command', () => {
    expect(parseHolders('p1234\ncnode\np5678\ncPython\n')).toEqual([
      { pid: '1234', command: 'node' },
      { pid: '5678', command: 'Python' },
    ]);
  });

  it('returns nothing when the port is free', () => {
    expect(parseHolders('')).toEqual([]);
  });

  it('ignores a command line with no pid before it', () => {
    expect(parseHolders('cnode\n')).toEqual([]);
  });
});

describe('devPorts', () => {
  it('defaults to 3000 for web and 4000 for the API outside a lane', () => {
    expect(devPorts({}, {})).toEqual([
      { port: 3000, service: 'apps/web' },
      { port: 4000, service: 'apps/api' },
    ]);
  });

  it('follows WEB_PORT and PORT when a lane sets them', () => {
    expect(devPorts({ PORT: '4018' }, { WEB_PORT: '3018', PORT: '4018' })).toEqual([
      { port: 3018, service: 'apps/web' },
      { port: 4018, service: 'apps/api' },
    ]);
  });

  it('resolves each port independently of the other', () => {
    expect(devPorts({}, { WEB_PORT: '3031' })).toEqual([
      { port: 3031, service: 'apps/web' },
      { port: 4000, service: 'apps/api' },
    ]);
  });

  it('falls back to the default when the value is not a usable port', () => {
    expect(devPorts({ PORT: '0' }, { WEB_PORT: 'not-a-port', PORT: '0' })).toEqual([
      { port: 3000, service: 'apps/web' },
      { port: 4000, service: 'apps/api' },
    ]);
  });

  /*
   * `apps/api` calls `loadEnv()` before reading `PORT`, so a value in the
   * repository-root `.env` moves the API port with no shell variable in sight.
   * Preflight gating on 4000 there is the same false pass a lane produces.
   */
  it('takes the API port from the env file when the shell does not set it', () => {
    expect(devPorts({ PORT: '4100' }, {})).toEqual([
      { port: 3000, service: 'apps/web' },
      { port: 4100, service: 'apps/api' },
    ]);
  });

  /*
   * `next dev ${WEB_PORT:+--port $WEB_PORT}` is a shell expansion and never
   * reads `.env`, so a `WEB_PORT` there moves nothing and must not be gated on.
   */
  it('ignores a WEB_PORT that only exists in the env file', () => {
    expect(devPorts({ WEB_PORT: '3100' }, {})).toEqual([
      { port: 3000, service: 'apps/web' },
      { port: 4000, service: 'apps/api' },
    ]);
  });
});

/*
 * The helper being right is not the same as the check using it: re-hardcoding
 * the call site left all of the above green. This is what pins it.
 */
describe('portsCheck', () => {
  const context = (env: NodeJS.ProcessEnv): CheckContext => ({
    repoRoot: '/nowhere',
    env,
    envFileFound: true,
    capabilities: new Set<Capability>(),
    target: 'local',
  });

  it('inspects the ports the resolved environment names, not 3000 and 4000', async () => {
    const previous = process.env.WEB_PORT;
    process.env.WEB_PORT = '3031';

    try {
      const results = await portsCheck.run(context({ PORT: '4031' }));

      expect(results.map((result) => result.name)).toEqual([
        'Port 3031 is available for apps/web',
        'Port 4031 is available for apps/api',
      ]);
    } finally {
      if (previous === undefined) delete process.env.WEB_PORT;
      else process.env.WEB_PORT = previous;
    }
  });

  it('checks nothing against production, where no dev server should be bound', async () => {
    expect(await portsCheck.run({ ...context({}), target: 'production' })).toEqual([]);
  });
});
