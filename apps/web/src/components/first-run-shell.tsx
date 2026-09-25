import type { ReactNode } from 'react';
import { Logo, LOGO_SIZES } from '@/components/brand/logo';

export const FIRST_RUN_SHELL_TEST_ID = 'first-run-shell';

export interface FirstRunShellProps {
  heading: string;
  /** The sentence under the heading; absent when the screen has nothing to say there. */
  sub?: ReactNode;
  subTestId?: string;
  /** The controls column: 460px, centred, 30px below the heading block. */
  children: ReactNode;
}

/**
 * The one shell a new customer's two first screens share — the welcome
 * (`/accept-terms`) and the name step (`/sign-up/customer-details`), frames 40
 * and 41 in `design/delta-customer-name-collection/`. Both render through it so
 * they cannot drift apart (VEN-744).
 *
 * The frame has no site header and no photo panel: the sell is over, this
 * person has an account. `data-auth-screen` is the attribute `globals.css`
 * keys the chrome removal off, so the header and footer are hidden here for
 * the same reason they are on sign-in.
 *
 * The heading is `text-display-error`, the 38px step frames `15` and `16`
 * already name: the frames' 38px / 1.14 has no step of its own, and a second
 * token for the same number would be the drift D30 warns about.
 */
export function FirstRunShell({
  heading,
  sub,
  subTestId,
  children,
}: FirstRunShellProps): React.ReactElement {
  return (
    <div
      data-auth-screen
      data-testid={FIRST_RUN_SHELL_TEST_ID}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-stone-50 px-6 py-10 sm:px-10"
    >
      <div
        aria-hidden="true"
        className="absolute -bottom-[170px] -left-[150px] size-[460px] rounded-full bg-stone-900/3"
      />
      <div
        aria-hidden="true"
        className="absolute -top-[160px] -right-[130px] size-[400px] rounded-full bg-clay-400/4.5"
      />

      <div className="relative w-full max-w-[700px]">
        <div className="mb-[34px] flex justify-center">
          <Logo size={LOGO_SIZES.authPanel} />
        </div>

        <div className="text-center">
          <h1 className="display-heading text-display-error leading-[1.14] text-stone-900">
            {heading}
          </h1>
          {sub ? (
            <p
              data-testid={subTestId}
              className="mx-auto mt-2.5 max-w-[460px] text-[14.5px] leading-[1.65] text-pretty text-stone-700"
            >
              {sub}
            </p>
          ) : null}
        </div>

        <div className="mx-auto mt-[30px] max-w-[460px]">{children}</div>
      </div>
    </div>
  );
}
