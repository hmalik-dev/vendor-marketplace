import { EventEmitter } from 'node:events';

import type { Page } from '@playwright/test';
import { describe, expect, it } from 'vitest';

import { recordExchanges, withoutQuery } from './request-log.js';

function fakeRequest(
  method: string,
  url: string,
  resourceType: string,
  headers: Record<string, string> = {},
): {
  method: () => string;
  url: () => string;
  resourceType: () => string;
  headers: () => Record<string, string>;
  failure: () => { errorText: string };
} {
  return {
    method: () => method,
    url: () => url,
    resourceType: () => resourceType,
    headers: () => headers,
    failure: () => ({ errorText: 'net::ERR_ABORTED' }),
  };
}

/** Just enough of a Playwright `Page` for the recorder: its events and its main frame. */
function fakePage(): { page: Page; emit: (event: string, payload: unknown) => void } {
  const emitter = new EventEmitter();
  const mainFrame = { url: () => 'http://localhost:3000/bookings/7?tab=x' };
  const page = {
    on: (event: string, listener: (payload: unknown) => void) => emitter.on(event, listener),
    mainFrame: () => mainFrame,
  } as unknown as Page;

  return {
    page,
    emit: (event, payload) => emitter.emit(event, payload === 'main' ? mainFrame : payload),
  };
}

describe('withoutQuery', () => {
  it('keeps the origin and path and drops the query and hash', () => {
    expect(withoutQuery('http://localhost:4000/v1/events/stream?ticket=secret#x')).toBe(
      'http://localhost:4000/v1/events/stream',
    );
  });
});

describe('recordExchanges', () => {
  it('logs requests, responses, failures and main-frame URLs in order, with elapsed time', () => {
    const { page, emit } = fakePage();
    let clock = 1_000;
    const log = recordExchanges(page, () => clock);
    const refresh = fakeRequest('GET', 'http://localhost:3000/bookings/7?_rsc=abc', 'fetch', {
      rsc: '1',
    });

    emit('request', refresh);
    clock = 1_007;
    emit('response', { status: () => 200, request: () => refresh, url: () => refresh.url() });
    emit('requestfinished', refresh);
    emit('framenavigated', 'main');
    emit('pageerror', new TypeError('boom\nat stack'));
    emit('requestfailed', refresh);

    expect(log).toEqual([
      '+0ms → GET http://localhost:3000/bookings/7 (RSC)',
      '+7ms ← 200 GET http://localhost:3000/bookings/7',
      '+7ms ✓ GET http://localhost:3000/bookings/7',
      '+7ms URL http://localhost:3000/bookings/7',
      '+7ms page error: TypeError: boom',
      '+7ms ✗ GET http://localhost:3000/bookings/7 net::ERR_ABORTED',
    ]);
  });

  it('skips static assets, other frames and any query string', () => {
    const { page, emit } = fakePage();
    const log = recordExchanges(page, () => 0);

    const script = fakeRequest('GET', 'http://localhost:3000/_next/static/app.js', 'script');
    emit('request', script);
    emit('response', { status: () => 200, request: () => script, url: () => script.url() });
    emit('requestfailed', script);
    emit('requestfinished', script);
    emit('framenavigated', { url: () => 'https://js.stripe.com/v3/elements' });
    emit(
      'request',
      fakeRequest('GET', 'https://api.stripe.com/v1/payment_intents/pi_1?client_secret=s', 'xhr'),
    );

    expect(log).toEqual(['+0ms → GET https://api.stripe.com/v1/payment_intents/pi_1']);
  });

  it('tells a prefetch apart from a refresh, which both send RSC: 1', () => {
    const { page, emit } = fakePage();
    const log = recordExchanges(page, () => 0);
    const url = 'http://localhost:3000/bookings/7?_rsc=abc';

    emit('request', fakeRequest('GET', url, 'fetch', { rsc: '1', 'next-router-prefetch': '1' }));
    emit('request', fakeRequest('GET', url, 'fetch', { rsc: '1' }));

    expect(log).toEqual([
      '+0ms → GET http://localhost:3000/bookings/7 (RSC prefetch)',
      '+0ms → GET http://localhost:3000/bookings/7 (RSC)',
    ]);
  });
});
