import { AUTH_COPY } from '@/app/auth-copy';

/**
 * Order matters in both lists: Edge, Opera and Chrome on iOS all carry
 * "Chrome" or "Safari" in their user agent, so the more specific token is
 * tested first.
 */
const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:Edg|EdgA|EdgiOS)\//, 'Edge'],
  [/\bOPR\/|\bOpera\b/, 'Opera'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/Chrome\/|\bCriOS\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
];

const SYSTEMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\biPhone\b|\biPad\b|\biPod\b/, 'iOS'],
  [/\bAndroid\b/, 'Android'],
  [/\bWindows\b/, 'Windows'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

function firstMatch(list: ReadonlyArray<readonly [RegExp, string]>, agent: string): string | null {
  return list.find(([pattern]) => pattern.test(agent))?.[1] ?? null;
}

/** A short label for a device from its user agent (`Chrome on macOS`), or `Unknown device`. */
export function deviceLabel(userAgent: string | null): string {
  if (userAgent === null) {
    return AUTH_COPY.unknownDevice;
  }

  const browser = firstMatch(BROWSERS, userAgent);
  const system = firstMatch(SYSTEMS, userAgent);

  if (browser !== null && system !== null) {
    return `${browser} on ${system}`;
  }

  return browser ?? system ?? AUTH_COPY.unknownDevice;
}
