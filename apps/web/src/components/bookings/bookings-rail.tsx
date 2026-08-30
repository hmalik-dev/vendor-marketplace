import { MONEY_COPY, shortTimeAgo } from '@vendor-marketplace/shared';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import type { BookingEntry } from '@/lib/booking-entries';
import type { WireConversation } from '@/lib/wire-schemas';

/**
 * The four mechanism promises. They are what the rail carries when there is
 * nothing waiting on the customer — `40-states.md` and frame `19` are explicit
 * that **the rail is never blanked**, because an empty column beside an empty
 * pane reads as a broken page rather than a new account.
 *
 * Every line is a mechanism rather than a statistic: none of them is a number
 * we would have to invent.
 */
const MECHANISM_PROMISES = [
  { title: 'Real availability.', body: 'Calendars come from the vendor, not a guess.' },
  { title: 'Payment is held.', body: 'Your money reaches the vendor after the event.' },
  /*
    Both halves of the fee story come from one place — `PLATFORM_FEE_COPY` —
    because this line and the vendor dashboard's "your share, after the
    platform fee" were written independently, were each true, and read as a
    flat contradiction to anyone who saw both.
  */
  MONEY_COPY.customer,
  { title: 'Reviews from real bookings.', body: 'Only events that happened here.' },
] as const;

export interface BookingsRailProps {
  /** Entries the customer has to act on — quotes to review, mostly. */
  needsYou: readonly BookingEntry[];
  /**
   * Whether this customer has any bookings at all — **not** whether the current
   * tab or filter shows any. The rail answers "is this a new account", and a
   * customer who filtered to Catering and found nothing has not become one.
   */
  hasBookings: boolean;
  /** Newest first; the rail draws the first three. */
  conversations: readonly WireConversation[];
}

/** Frame `07` draws three rows before the rail's own scroll takes over. */
const RECENT_MESSAGE_COUNT = 3;

/**
 * The 340px rail of frames `07` and `19`.
 *
 * "Needs you" is clay because clay means *you can act here* — it is the one
 * tone reserved for the reader's own move.
 *
 * **The two frames draw different rails, and until #302 this drew both at
 * once.** `How booking works here` and its four promises belong to frame `19`,
 * the empty hub — they are what a new account is told instead of being shown an
 * empty column. Frame `07` draws `Needs you` and then `Recent messages`. The
 * mechanism block was rendered unconditionally, so a customer with eleven
 * bookings was still being told how booking works, and the recent-messages block
 * did not exist at all.
 */
export function BookingsRail({
  needsYou,
  hasBookings,
  conversations,
}: BookingsRailProps): React.ReactElement {
  const recent = conversations.slice(0, RECENT_MESSAGE_COUNT);

  /*
    The label follows the content rather than describing the best case. A fixed
    "What needs your attention" announced a section that was not rendered —
    #81's ninth finding — and #302 gave the rail a third shape, so there are now
    three answers rather than two: the quotes waiting, the threads, or frame
    `19`'s promises. Each one names the heading the reader actually meets.
  */
  const label =
    needsYou.length > 0
      ? 'What needs your attention'
      : hasBookings
        ? 'Recent messages'
        : 'How booking works here';

  return (
    <aside
      aria-label={label}
      className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-stone-300 bg-stone-0 p-5 xl:block"
    >
      {needsYou.length > 0 ? (
        <>
          <h2 className="mb-2.75 text-label font-semibold tracking-label text-stone-600 uppercase">
            Needs you
          </h2>
          <ul className="mb-5">
            {needsYou.map((entry) => (
              <li key={entry.id} className="mb-2.5 rounded-xl bg-clay-100 p-3.25">
                <div className="flex items-start gap-2.25">
                  <span
                    aria-hidden="true"
                    className="mt-1.25 size-1.75 shrink-0 rounded-full bg-clay-400"
                  />
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-stone-900">
                      {entry.vendorName} sent a quote
                    </p>
                    <p className="mt-0.75 text-sm leading-normal text-stone-700">{entry.subline}</p>
                    {/* The request, not the storefront — see `bookings-hub.tsx`. */}
                    <Link
                      href={`/bookings/${entry.id}`}
                      className="mt-2.5 inline-block rounded-md bg-clay-400 px-3.25 py-1.75 text-sm font-semibold text-stone-0 hover:bg-clay-500"
                    >
                      Review quote
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {hasBookings ? (
        /*
          Frame `07`'s second block. Rendered even with nothing in it: the rail
          is never blanked, and a customer with bookings and no replies yet is
          told so rather than shown a column that stops halfway.
        */
        <>
          <h2 className="mb-2.75 text-label font-semibold tracking-label text-stone-600 uppercase">
            Recent messages
          </h2>
          {recent.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {recent.map((conversation) => (
                <li key={conversation.id} className="border-b border-stone-200 last:border-b-0">
                  <Link
                    href={`/messages?conversation=${conversation.id}`}
                    className="flex items-start gap-2.5 py-2.5"
                  >
                    <Avatar
                      name={conversation.otherPartyName}
                      src={conversation.otherPartyAvatarUrl}
                      size="row"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between gap-2">
                        <span className="truncate text-action font-semibold text-stone-900">
                          {conversation.otherPartyName}
                        </span>
                        <span className="shrink-0 text-xs text-stone-600">
                          {shortTimeAgo(conversation.lastMessageAt)}
                        </span>
                      </span>
                      {/*
                        One line, clipped. The frame draws a preview that stops
                        mid-sentence — it is a pointer into the thread, not the
                        message.
                      */}
                      <span className="mt-0.5 block truncate text-meta text-stone-700">
                        {conversation.lastMessagePreview ?? 'No messages yet'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            /*
              `31-content-voice.md`'s approved line for this exact fact, taken
              from `/messages`'s own empty state rather than written fresh — a
              second sentence for one idea is how two surfaces come to describe
              the same thing differently.

              Near-unreachable in production: `ensureConversation` opens a thread
              with every booking request, so bookings imply threads. It shows up
              when requests are written straight to the table, which is what the
              seeds do.
            */
            <p className="text-sm leading-normal text-stone-700">
              A thread opens the moment you send a booking request, so the whole negotiation stays
              attached to the booking.
            </p>
          )}
        </>
      ) : (
        <>
          <h2 className="mb-3 text-label font-semibold tracking-label text-stone-600 uppercase">
            How booking works here
          </h2>
          <div className="flex flex-col gap-3.5 text-base leading-prose text-stone-700">
            {MECHANISM_PROMISES.map((promise, index) => (
              <div key={promise.title}>
                {index > 0 ? <span className="mb-3.5 block h-px bg-stone-200" /> : null}
                <p>
                  <strong className="font-semibold text-stone-900">{promise.title}</strong>{' '}
                  {promise.body}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
