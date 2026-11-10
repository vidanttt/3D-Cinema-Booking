import { MAX_SEATS } from '../data/cinema'
import type { Seat } from '../types'
import { BookingActions } from './BookingActions'
import { BookingSummary, TotalPrice } from './BookingSummary'
import { GlassPanel } from './GlassPanel'

interface Props {
  seats: Seat[]
  total: number
  loading: boolean
  onRemove: (id: string) => void
  onPreview: () => void
}

/** Floating glass dock. It morphs into the seat panel when the preview opens. */
export function BookingDock({ seats, total, loading, onRemove, onPreview }: Props) {
  const empty = seats.length === 0
  return (
    <div
      data-anim="dock"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-6"
    >
      <GlassPanel
        id="dock"
        data-flip-id="dock"
        role="region"
        aria-label="Your booking"
        className="pointer-events-auto w-full max-w-[720px] rounded-[30px] p-2.5 sm:w-auto sm:min-w-[520px] sm:rounded-full sm:pl-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-5">
          <div className="flex min-h-12 min-w-0 flex-1 items-center gap-4 px-2.5 sm:px-0">
            {empty ? (
              <p className="flex-1 text-[13.5px] leading-snug text-mute">
                <span className="text-ink">Pick a seat.</span> We’ll show you the exact view from it.
              </p>
            ) : (
              <>
                <BookingSummary seats={seats} mode="remove" onChip={onRemove} className="flex-1 py-1" />
                <span
                  className={`num hidden shrink-0 text-[11px] sm:block ${seats.length >= MAX_SEATS ? 'text-accent' : 'text-mute'}`}
                >
                  {seats.length}/{MAX_SEATS}
                </span>
                <TotalPrice total={total} count={seats.length} />
              </>
            )}
          </div>
          {/* On phones the button row folds away until there is something to preview. */}
          <div
            className={`grid transition-[grid-template-rows,margin] duration-500 ease-[var(--ease-expo)] sm:!mt-0 sm:!grid-rows-[1fr] ${empty ? 'mt-0 grid-rows-[0fr]' : 'mt-2 grid-rows-[1fr]'}`}
          >
            <div className="min-h-0 overflow-hidden rounded-full sm:overflow-visible">
              <BookingActions stage="select" disabled={empty} loading={loading} onPreview={onPreview} />
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  )
}
