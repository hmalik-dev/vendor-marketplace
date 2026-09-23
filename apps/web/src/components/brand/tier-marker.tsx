/**
 * VEN-660. The marker every deployed tier but production draws beside its
 * wordmark, so a person can never mistake staging for production: staging is a
 * real deployment with its own Neon Auth, and a sign-up there looks exactly
 * like one on production until the account turns up on the wrong tier.
 *
 * The tier is `NEXT_PUBLIC_DEPLOY_ENV`, the validated `DEPLOY_ENV` that
 * `next.config.ts` inlines at build, so a server and a client render agree and
 * a deployment cannot build without one. `local` draws nothing: a laptop is
 * not a tier anyone confuses with production, and the parity gate compares a
 * local page against frames that carry no marker.
 *
 * The frames draw no marker, because it is a claim about the deployment rather
 * than the product; it takes the checkout test strip's scaffolding look (ink,
 * mono, the amber dot) for the same reason.
 */
const UNMARKED_TIERS = new Set(['production', 'local']);

/** The marker's text for `tier`, or `null` where none is drawn. */
export function tierMarkerLabel(tier: string | undefined): string | null {
  if (!tier || UNMARKED_TIERS.has(tier)) {
    return null;
  }
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function TierMarker({
  tone = 'light',
}: {
  /** `dark` on the console's inverted header, where ink would vanish. */
  tone?: 'light' | 'dark';
}): React.ReactElement | null {
  const label = tierMarkerLabel(process.env.NEXT_PUBLIC_DEPLOY_ENV);
  if (!label) {
    return null;
  }

  const colours = tone === 'dark' ? 'bg-stone-0 text-stone-900' : 'bg-stone-900 text-stone-50';
  return (
    <span
      data-testid="tier-marker"
      className={`ml-1 inline-flex flex-none items-center gap-1.5 rounded-[5px] px-2 py-1 font-mono text-[11px] leading-[normal] font-semibold tracking-[0.06em] uppercase ${colours}`}
    >
      <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-[#E0A83C]" />
      {label}
    </span>
  );
}
