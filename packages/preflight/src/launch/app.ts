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
      // The invite-only switch is added to `platform_settings` by VEN-406.
      // Until that column is on main there is nothing to read.
      group: 'app',
      name: 'platform_settings.vendorInviteOnly',
      run: async () => [
        {
          group: 'app',
          name: 'platform_settings.vendorInviteOnly',
          status: 'SKIP',
          detail: 'not in this tree until VEN-406 lands; a beta release needs it on',
        },
      ],
    },
  ];
}
