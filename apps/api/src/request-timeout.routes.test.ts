import { connect, type AddressInfo } from 'node:net';
import { request as httpRequest } from 'node:http';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { MAX_UPLOAD_BYTES } from '@vendor-marketplace/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bearer, createTestHarness, type TestHarness } from './testing/test-server.js';

const VENDOR = 'user_vendor_timeout';
const BOUNDARY = '----timeoutboundary';
const UPLOAD_PATH = '/upload/image?prefix=vendor-profile';
const REQUEST_TIMEOUT_MS = 2_000;
/** Over the timeout plus scheduling slack, so a pass is never a race. */
const CUT_OFF_WITHIN_MS = REQUEST_TIMEOUT_MS + 1_500;

describe('the request timeout', () => {
  const errorReporter = { capture: vi.fn() };
  let harness: TestHarness;
  let port: number;

  beforeAll(async () => {
    harness = await createTestHarness({ requestTimeoutMs: REQUEST_TIMEOUT_MS, errorReporter });
    harness.authUsers.set(VENDOR, {
      authUserId: VENDOR,
      email: 'timeout@example.com',
      firstName: 'Slow',
      lastName: 'Client',
      roleHint: 'vendor',
      avatarUrl: null,
    });
    await harness.app.listen({ port: 0, host: '127.0.0.1' });
    port = (harness.app.server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('closes an upload that sends half its body and stops', async () => {
    const started = Date.now();
    const socket = connect({ port, host: '127.0.0.1' });
    const closed = new Promise<void>((resolve) => socket.on('close', () => resolve()));
    socket.on('error', () => {});
    socket.write(
      `POST ${UPLOAD_PATH} HTTP/1.1\r\n` +
        'Host: localhost\r\n' +
        `Authorization: ${bearer(VENDOR).authorization}\r\n` +
        `Content-Type: multipart/form-data; boundary=${BOUNDARY}\r\n` +
        'Content-Length: 100000\r\n\r\n' +
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\n` +
        'Content-Type: image/jpeg\r\n\r\nhalf',
    );

    await Promise.race([
      closed,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('socket still open')), CUT_OFF_WITHIN_MS),
      ),
    ]);

    expect(Date.now() - started).toBeGreaterThanOrEqual(REQUEST_TIMEOUT_MS - 50);
    // The defence working is not an incident.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(errorReporter.capture).not.toHaveBeenCalled();
  });

  it.each([
    ['a GET with no body header', ''],
    ['a GET that declares Content-Length: 0', 'Content-Length: 0\r\n'],
  ])('does not close an open event stream opened by %s', async (_name, extraHeader) => {
    const issued = await harness.app.inject({
      method: 'POST',
      url: '/events/stream-ticket',
      headers: bearer(VENDOR),
    });
    const ticket: string = issued.json().ticket;

    const socket = connect({ port, host: '127.0.0.1' });
    let received = '';
    let closed = false;
    socket.on('data', (chunk) => {
      received += chunk.toString();
    });
    socket.on('close', () => {
      closed = true;
    });
    socket.on('error', () => {});
    socket.write(
      `GET /events/stream?ticket=${ticket} HTTP/1.1\r\nHost: localhost\r\n${extraHeader}\r\n`,
    );

    await vi.waitFor(() => expect(received).toContain('text/event-stream'));
    await new Promise((resolve) => setTimeout(resolve, REQUEST_TIMEOUT_MS * 1.5));
    const stillOpen = !closed;
    socket.destroy();

    expect(received.startsWith('HTTP/1.1 200')).toBe(true);
    expect(stillOpen).toBe(true);
  });

  it('lets a paced upload near the size limit that finishes inside the window succeed', async () => {
    // Noise does not compress, so this lands near `MAX_UPLOAD_BYTES` rather than at tens of KB.
    const side = 2600;
    const image = await sharp(randomBytes(side * side * 3), {
      raw: { width: side, height: side, channels: 3 },
    })
      .jpeg({ quality: 100 })
      .toBuffer();
    expect(image.length).toBeGreaterThan(MAX_UPLOAD_BYTES / 2);
    expect(image.length).toBeLessThan(MAX_UPLOAD_BYTES);
    const head = Buffer.from(
      `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\n` +
        'Content-Type: image/jpeg\r\n\r\n',
    );
    const tail = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);
    const body = Buffer.concat([head, image, tail]);

    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path: UPLOAD_PATH,
          method: 'POST',
          headers: {
            ...bearer(VENDOR),
            'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
            'content-length': body.length,
          },
        },
        (response) => {
          response.resume();
          resolve(response.statusCode ?? 0);
        },
      );
      req.on('error', reject);
      // Paced in writes rather than one, and finished inside the window.
      void (async () => {
        const step = Math.ceil(body.length / 10);
        for (let at = 0; at < body.length; at += step) {
          req.write(body.subarray(at, at + step));
          await new Promise((r) => setTimeout(r, 30));
        }
        req.end();
      })();
    });

    expect(status).toBe(201);
  });
});
