'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BRAND_NAME,
  LEGAL_PATHS,
  PASSWORD_MIN_LENGTH,
  type SignUpRole,
} from '@vendor-marketplace/shared';
import { AUTH_COPY, failureCopy } from '@/app/auth-copy';
import { AuthField } from '@/components/auth/auth-field';
import { AuthScreen } from '@/components/auth/auth-screen';
import { VerifyEmailStep } from '@/components/auth/verify-email-step';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import {
  type AuthOutcome,
  resendVerificationCode,
  signUpWithEmail,
} from '@/lib/auth/auth-requests';
import { cn } from '@/lib/utils';

export type { SignUpRole };

interface RoleChoice {
  role: SignUpRole;
  title: string;
  description: string;
  /**
   * The muted geometric glyph in the card's circle. A square for planning an
   * event, a circle for offering a service — abstract on purpose, because
   * neither side is an icon a first-time visitor would already recognise.
   */
  glyph: 'square' | 'circle';
  /**
   * The selected card's accent, matched to the marketing panel beside it: clay
   * for the customer, sage for the vendor. Sage is the settled, working-side
   * colour throughout the product, so the vendor path is coloured the way the
   * vendor's own surfaces are.
   */
  selectedCard: string;
  selectedGlyph: string;
}

const ROLE_CHOICES: readonly RoleChoice[] = [
  {
    role: 'customer',
    title: "I'm planning an event",
    description: 'Find and book vendors near you.',
    glyph: 'square',
    selectedCard: 'border-2 border-clay-400 bg-clay-100',
    selectedGlyph: 'border-clay-500',
  },
  {
    role: 'vendor',
    title: "I'm a vendor",
    description: 'List your services and take bookings.',
    glyph: 'circle',
    selectedCard: 'border-2 border-sage-400 bg-sage-50',
    selectedGlyph: 'border-sage-600',
  },
];

export interface SignUpFormProps {
  /**
   * Pre-selection from `?role=`, which "For vendors" in the nav carries.
   * `null` — the bare `/sign-up` — asks the question outright and shows the
   * both-sides panel, which picks no side before the visitor does.
   */
  initialRole: SignUpRole | null;
  /**
   * Whether vendors are admitted by invitation only. Read on the server by the
   * page so the notice is in the first paint; `false` when unreadable, which
   * shows nothing rather than a waitlist that may not exist.
   */
  vendorInviteOnly: boolean;
}

/**
 * Role is chosen before the form is submitted and travels with the sign-up:
 * the auth proxy records it on the server against the account Neon creates
 * (VEN-662), and the accept-terms screen states it from there on any device.
 * The API still refuses anything but `customer` or `vendor`, and still gates a
 * vendor on an invite when the account row is made.
 *
 * The choice is irreversible, so it is made visibly: the cards stay on screen
 * after selection rather than collapsing to a line of text, and they sit side
 * by side at every width above 640 because they are a comparison — stacking
 * turns a choice into a scroll.
 *
 * Selecting a role also swaps the marketing panel beside the form. The form
 * column itself does not move: the choice is the only thing that changes the
 * page. See design/design-plan/21-sign-up.md.
 */
export function SignUpForm({ initialRole, vendorInviteOnly }: SignUpFormProps): React.ReactElement {
  const [role, setRole] = useState<SignUpRole | null>(initialRole);
  /* Set only when a submit was actually blocked, so the hint announces itself
     to a screen reader at the moment it becomes the reason nothing happened. */
  const [roleMissing, setRoleMissing] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /* The code step replaces the form. The role question is not asked again: the
     subhead promises the choice cannot be changed later. */
  const [verifying, setVerifying] = useState(false);
  const [sendOutcome, setSendOutcome] = useState<AuthOutcome>('ok');

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    /* Asked here, and only here: the server records it with the account and
       the accept-terms screen states it without asking again. */
    if (role === null) {
      setRoleMissing(true);
      return;
    }
    if (busy) {
      return;
    }

    setBusy(true);
    setFailure(null);

    /* Neon requires a display name; the form asks for none (frame `12` has
       email and password only), so the address's local part stands in. */
    const { outcome, codeSent } = await signUpWithEmail({
      email: email.trim(),
      password,
      name: email.trim().split('@')[0] || 'member',
      role,
    });

    if (outcome === 'ok') {
      /* Only when Neon mailed nothing: a second send rotates the code, and the
         first mail's code — usually the one read — stops working. The account
         exists whatever the send answers: the code step shows a refused send
         and offers "Send a new code" rather than failing here. */
      if (!codeSent) {
        setSendOutcome(await resendVerificationCode(email.trim()));
      }
      setBusy(false);
      setVerifying(true);
      return;
    }

    setBusy(false);

    setFailure(failureCopy(outcome, AUTH_COPY.signUpFailed));
  }

  // Neither a network failure nor a throttle says anything about what the reader typed.
  const credentialsRefused =
    failure !== null && failure !== AUTH_COPY.unreachable && failure !== AUTH_COPY.throttled;

  return (
    <AuthScreen
      headline="Let's get you set up"
      subhead="First — which one are you? This can't be changed later."
      panel={role ?? 'both'}
    >
      {/*
        Not rendered at all once the role has been read back off the in-flight
        attempt — that only happens after verification remounted the page, and
        the answer is already given. `hidden` would be the wrong tool here: it
        leaves the radios in the DOM and in the form, so the question stays
        submittable by anything that walks it. The panel beside the form still
        reflects the choice, so the screen does not go neutral either.
      */}
      {verifying ? null : (
        <fieldset className="mb-5.5">
          <legend className="sr-only">Which one are you?</legend>

          {/*
          Side by side at every width above 640: the two roles are a comparison,
          and stacking turns a choice into a scroll. At 390 the screen is a
          single column, per the degradation table in 30-responsive.md.
        */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ROLE_CHOICES.map((choice) => {
              const isSelected = role === choice.role;

              return (
                <label
                  key={choice.role}
                  className={cn(
                    'cursor-pointer rounded-xl px-3.5 py-4 transition-colors duration-(--duration-fast)',
                    // The offset colour is not optional: without it the ring's offset
                    // band draws Tailwind's default white on the panel's stone-50.
                    'has-focus-visible:ring-2 has-focus-visible:ring-clay-400 has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-stone-50',
                    isSelected
                      ? choice.selectedCard
                      : 'border border-stone-300 bg-stone-0 hover:border-stone-400',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={choice.role}
                    checked={isSelected}
                    onChange={() => {
                      setRole(choice.role);
                      setRoleMissing(false);
                    }}
                    /* The card above rings for this radio; it does not ring itself. */
                    data-focus-own
                    className="sr-only"
                  />

                  <span
                    aria-hidden="true"
                    className={cn(
                      'mb-2.5 flex size-8.5 items-center justify-center rounded-full',
                      isSelected ? 'bg-stone-0' : 'bg-stone-150',
                    )}
                  >
                    <span
                      className={cn(
                        'block size-3.25 border-[1.6px]',
                        choice.glyph === 'circle' ? 'rounded-full' : 'rounded-[3px]',
                        isSelected ? choice.selectedGlyph : 'border-stone-600',
                      )}
                    />
                  </span>

                  <span className="block text-[14.5px] font-semibold text-stone-900">
                    {choice.title}
                  </span>
                  <span className="mt-1 block text-[12px] leading-normal text-stone-700">
                    {choice.description}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {verifying ? (
        <VerifyEmailStep
          email={email.trim()}
          password={password}
          destination="/after-sign-in"
          sendOutcome={sendOutcome}
        />
      ) : (
        /*
          The fields stay live with no role chosen — typing first and choosing
          second is a normal order — and only the submit is gated.
          `data-role-pending` is what globals.css keys the disabled treatment
          off. See design/design-plan/21-sign-up.md.
        */
        <form
          onSubmit={submit}
          noValidate
          className="flex flex-col"
          data-role-pending={role === null ? '' : undefined}
        >
          {failure ? (
            <Banner status="failed" role="alert" className="mb-4">
              {failure}
            </Banner>
          ) : null}

          <AuthField
            label={AUTH_COPY.emailLabel}
            type="email"
            placeholder="you@example.com"
            name="email"
            autoComplete="email"
            aria-invalid={credentialsRefused ? true : undefined}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <AuthField
            label={AUTH_COPY.passwordLabel}
            helper={AUTH_COPY.passwordHelper}
            type="password"
            placeholder="••••••••••"
            name="password"
            autoComplete="new-password"
            aria-invalid={credentialsRefused ? true : undefined}
            minLength={PASSWORD_MIN_LENGTH}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {/* Plain copy over a hairline, not a banner: it is how the product works, not a state (frame 35 in design/delta-waitlist). `role="status"` announces it when a role pick inserts it. */}
          {role === 'vendor' && vendorInviteOnly ? (
            <p
              data-invite-notice=""
              role="status"
              className="-mt-px mb-3.25 border-t border-stone-300 pt-3 text-[12.5px] leading-[1.65] text-stone-700"
            >
              Vendors join {BRAND_NAME} by invitation for now. Sign up and we&apos;ll add you to the
              waitlist.
            </p>
          ) : null}

          <Button
            type="submit"
            className="py-3.25"
            loading={busy}
            aria-disabled={role === null ? true : undefined}
            disabled={email.trim() === '' || password.length < PASSWORD_MIN_LENGTH}
          >
            {AUTH_COPY.signUpSubmit}
          </Button>

          {/* The hint explains the disabled button, so it sits directly beneath it. */}
          {role === null ? (
            <p
              data-role-hint=""
              className="mt-1.5 text-center text-helper text-stone-600"
              role={roleMissing ? 'alert' : undefined}
            >
              {AUTH_COPY.roleHint}
            </p>
          ) : null}

          {/* A notice only, frame 12's wording: nothing is recorded here. The acceptance is written on the confirm screen. */}
          <p
            className={cn(
              'text-center text-helper leading-[1.55] text-stone-600',
              // 13px under the "Pick one above" hint, 10px under the button (frame 35).
              role === null ? 'mt-3.25' : 'mt-2.5',
            )}
          >
            By signing up, you agree to the{' '}
            <Link href={LEGAL_PATHS.terms} className="text-clay-500 underline underline-offset-2">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href={LEGAL_PATHS.privacy} className="text-clay-500 underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>

          <p className="mt-3.25 text-center text-action text-stone-700">
            {AUTH_COPY.signUpAlt}{' '}
            <Link href="/sign-in" className="font-semibold text-clay-500 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthScreen>
  );
}
