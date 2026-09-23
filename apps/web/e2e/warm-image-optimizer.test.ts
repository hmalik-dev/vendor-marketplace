import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DEVICE_SIZES, IMAGE_QUALITY, IMAGE_SIZES } from '../src/config/image-optimizer';
import { optimizerWarmupPaths, warmImageOptimizer } from './warm-image-optimizer';

function publicDirWith(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'warm-optimizer-'));
  for (const file of files) {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), 'x');
  }
  return dir;
}

let server: Server | null = null;

afterEach(async () => {
  const open = server;
  server = null;
  if (open) {
    open.closeAllConnections();
    await new Promise((resolve) => open.close(resolve));
  }
});

/** A web server whose `/_next/image` answers per `answer`; `null` never answers at all. */
async function serve(answer: (path: string) => number | null): Promise<{
  origin: string;
  seen: Array<{ path: string; accept: string | undefined }>;
}> {
  const seen: Array<{ path: string; accept: string | undefined }> = [];
  server = createServer((req, res) => {
    seen.push({ path: req.url ?? '', accept: req.headers.accept });
    const status = answer(req.url ?? '');
    if (status !== null) {
      res.writeHead(status).end();
    }
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${(server!.address() as AddressInfo).port}`, seen };
}

describe('optimizerWarmupPaths', () => {
  it('asks for every raster under public/ at every width the optimizer allows', () => {
    const dir = publicDirWith(['stock/florals.jpg', 'categories/decor.webp', 'favicon.ico']);
    const paths = optimizerWarmupPaths(dir);
    const widths = [...IMAGE_SIZES, ...DEVICE_SIZES];

    expect(paths).toHaveLength(2 * widths.length);
    for (const src of ['/categories/decor.webp', '/stock/florals.jpg']) {
      for (const width of widths) {
        expect(paths).toContain(
          `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${IMAGE_QUALITY}`,
        );
      }
    }
    expect(paths.some((path) => path.includes('favicon'))).toBe(false);
  });

  it('includes the landing art the hang was on', () => {
    const paths = optimizerWarmupPaths(join(__dirname, '../public'));

    expect(paths).toContain('/_next/image?url=%2Fcategories%2Fphotography.jpg&w=256&q=75');
    expect(paths).toContain('/_next/image?url=%2Fstock%2Fflorals.jpg&w=256&q=75');
  });
});

describe('warmImageOptimizer', () => {
  const paths = ['/_next/image?url=%2Fa.jpg&w=64&q=75', '/_next/image?url=%2Fb.jpg&w=64&q=75'];

  it('fetches each path once, asking for the format a browser asks for', async () => {
    const { origin, seen } = await serve(() => 200);

    await warmImageOptimizer(origin, paths, { timeoutMs: 2_000 });

    expect(seen.map((request) => request.path).sort()).toEqual([...paths].sort());
    for (const request of seen) {
      expect(request.accept).toContain('image/webp');
    }
  });

  it('gives up on an optimizer that never answers, by name, within the deadline', async () => {
    const { origin } = await serve((path) => (path === paths[1] ? null : 200));
    const started = Date.now();

    await expect(warmImageOptimizer(origin, paths, { timeoutMs: 300 })).rejects.toThrow(
      `did not answer within 300ms: ${paths[1]}`,
    );
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('names a path the optimizer refuses', async () => {
    const { origin } = await serve((path) => (path === paths[0] ? 400 : 200));

    await expect(warmImageOptimizer(origin, paths, { timeoutMs: 2_000 })).rejects.toThrow(
      `answered HTTP 400: ${paths[0]}`,
    );
  });
});
