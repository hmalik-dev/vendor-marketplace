import { MessageBubbleSkeleton, Skeleton } from '@/components/ui/skeleton';

/**
 * The messages screen while the conversation list is in flight.
 *
 * The two-pane shell, the sidebar's width and its header are structural — they
 * are the same whether there are twenty threads or none — so they stay drawn.
 * What is unknown is who the threads are with and what was said, and that is
 * all the skeletons claim.
 *
 * The bubbles alternate sides deliberately. A thread is a conversation, and a
 * column of same-side blocks would read as a list of notices instead.
 */
export default function MessagesLoading(): React.ReactElement {
  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] overflow-hidden">
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-stone-300 bg-stone-0 max-md:hidden">
        <div className="flex items-center justify-between border-b border-stone-200 px-4.5 py-3.5">
          <h1 className="text-md font-semibold text-stone-900">Messages</h1>
        </div>

        <ul aria-busy="true" aria-label="Loading your conversations" className="min-h-0 flex-1">
          {Array.from({ length: 7 }, (_, index) => (
            <li key={index} className="flex gap-2.75 border-b border-stone-200 px-4.5 py-3.25">
              {/* The `md` avatar the real row draws. */}
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="mt-2 h-3 w-full" />
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <div aria-busy="true" className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2.75 border-b border-stone-200 px-5 py-3.5">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5">
          <MessageBubbleSkeleton />
          <MessageBubbleSkeleton mine />
          <MessageBubbleSkeleton />
          <MessageBubbleSkeleton mine />
        </div>
      </div>
    </div>
  );
}
