import { failed, judge, originOf, passed, type LaunchOptions, type Probe } from './types.js';

/**
 * The headers `apps/web/src/config/security-headers.ts` sets, by name. Only the
 * enforcing `Content-Security-Policy` counts: `-Report-Only` blocks nothing.
 */
const REQUIRED_SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
] as const;

const READY_STATUS = 200;

export function appProbes({ env, get }: LaunchOptions): Probe[] {
  return [
    {
      group: 'app',
      name: 'api /ready',
      async run() {
        const reply = await get(`${originOf(env, 'API_URL')}/ready`);
        return [
          judge(
            'app',
            'api /ready',
            String(reply.status),
            reply.status === READY_STATUS,
            String(READY_STATUS),
          ),
        ];
      },
    },
    {
      group: 'app',
      name: 'web security headers',
      async run() {
        const reply = await get(originOf(env, 'WEB_URL'));
        const missing = REQUIRED_SECURITY_HEADERS.filter((header) => !reply.headers.has(header));
        return [
          missing.length > 0
            ? failed('app', 'web security headers', `missing ${missing.join(', ')}`)
            : passed(
                'app',
                'web security headers',
                `all ${REQUIRED_SECURITY_HEADERS.length} present`,
              ),
        ];
      },
    },
    {
      // The launch switches live in `platform_settings`, which VEN-404 and
      // VEN-406 add. Until that schema is on main there is nothing to read.
      group: 'app',
      name: 'platform_settings',
      run: async () => [
        {
          group: 'app',
          name: 'platform_settings.vendorInviteOnly',
          status: 'SKIP',
          detail: 'not in this tree until VEN-406 lands; a beta release needs it on',
        },
        {
          group: 'app',
          name: 'platform_settings.maxBookingCents',
          status: 'SKIP',
          detail: 'not in this tree until VEN-404 lands; a beta release needs it set',
        },
      ],
    },
  ];
}
