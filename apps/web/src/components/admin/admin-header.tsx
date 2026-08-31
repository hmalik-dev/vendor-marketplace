import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Logo } from '@/components/brand/logo';

export interface AdminHeaderProps {
  /** The signed-in operator's email — frame `13` prints it beside the avatar. */
  email: string;
  /** Drives the avatar's initial. One word, so one letter — as frame `13` draws. */
  name: string;
}

/**
 * The inverted header frame `13` draws.
 *
 * The inversion is the point: it is the one unmistakable signal that this
 * surface acts on other people's accounts. It replaces `SiteHeader` rather than
 * sitting beneath it — see `OutsideAdmin` in `public-chrome.tsx`.
 *
 * The avatar is the shared `Avatar` at its `xs` step — the 30px frame `13`
 * draws — with the ground and the initial swapped for the inverted pair the
 * frame uses. The colours are an override rather than a new tone: the fallback
 * ramp exists to distinguish *people* from each other, and there is exactly one
 * operator in this header.
 */
export function AdminHeader({ email, name }: AdminHeaderProps): React.ReactElement {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center justify-between border-b border-stone-800 bg-stone-900 px-8">
      <div className="flex items-center gap-1">
        <Link
          href="/admin"
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-clay-400"
        >
          <Logo tone="dark" />
        </Link>
        <span className="ml-1 rounded-[5px] bg-stone-0/12 px-2 py-1 text-xs font-semibold tracking-[.06em] text-clay-150 uppercase">
          Admin
        </span>
      </div>

      <div className="flex items-center gap-4.5">
        <span className="text-base text-stone-400">Logged in as {email}</span>
        <Avatar name={name} size="xs" className="bg-stone-700 text-clay-150" />
      </div>
    </header>
  );
}
