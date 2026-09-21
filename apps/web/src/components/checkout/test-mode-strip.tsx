/**
 * Frame `39`'s strip: the checkout runs on Stripe test keys, so no money moves.
 *
 * **The gate is the key and nothing else.** A `DEPLOY_ENV`, a build flag or an
 * env name can disagree with the key the bundle actually uses; the prefix cannot.
 * A live key renders nothing and there is no override. It is read from
 * `process.env` at render rather than through `publicEnv`, which throws when the
 * key is absent, because this strip sits in the layout that also wraps the
 * `not-found` and `error` boundaries.
 *
 * The colours are the frame's own: ink and mono read as developer scaffolding,
 * outside the four state families in `40-states.md`, because the strip makes a
 * claim about the build rather than about the booking. The amber dot has no token.
 *
 * The frame draws it on one line. At 390px that is 350px for ~520px of 11.5px
 * mono, so below `md` the copy wraps to two lines and the strip grows to 48px,
 * which is what the design says to do rather than truncate it.
 */
export const TEST_MODE_COPY =
  "Test mode: no real money moves. Use Stripe's test card 4242 4242 4242 4242.";

export function isStripeTestKey(key: string | undefined): boolean {
  return key?.startsWith('pk_test_') ?? false;
}

export function TestModeStrip(): React.ReactElement | null {
  if (!isStripeTestKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)) {
    return null;
  }

  return (
    <div
      data-testid="test-mode-strip"
      className="flex min-h-8.5 flex-none items-center justify-center gap-2.25 bg-stone-900 px-5 py-2"
    >
      <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-[#E0A83C]" />
      <p className="text-center font-mono text-[11.5px] leading-4 tracking-[0.01em] text-stone-50 md:whitespace-nowrap">
        {TEST_MODE_COPY}
      </p>
    </div>
  );
}
