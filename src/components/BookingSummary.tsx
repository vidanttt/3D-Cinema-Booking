import { X } from 'lucide-react'
import { money, pad2 } from '../data/cinema'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import type { Seat } from '../types'

interface Props {
  seats: Seat[]
  activeId?: string | null
  /** `remove` chips drop the seat; `focus` chips switch the previewed seat. */
  mode: 'remove' | 'focus'
  onChip: (id: string) => void
  className?: string
}

/** The chosen seats as a row of chips. */
export function BookingSummary({ seats, activeId, mode, onChip, className = '' }: Props) {
  return (
    <ul aria-label="Selected seats" className={`no-scrollbar flex items-center gap-1.5 overflow-x-auto ${className}`}>
      {seats.map((seat) => {
        const active = mode === 'focus' && seat.id === activeId
        return (
          <li key={seat.id} className="chip-in shrink-0">
            <button
              type="button"
              className="chip"
              data-active={active}
              aria-pressed={mode === 'focus' ? active : undefined}
              aria-label={
                mode === 'remove'
                  ? `Remove row ${seat.row}, seat ${seat.number}`
                  : `View from row ${seat.row}, seat ${seat.number}`
              }
              onClick={() => onChip(seat.id)}
            >
              <span className="num">
                {seat.row}
                {pad2(seat.number)}
              </span>
              {mode === 'remove' && <X size={12} strokeWidth={2.2} className="opacity-50" aria-hidden />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function TotalPrice({ total, count, className = '' }: { total: number; count: number; className?: string }) {
  const { ref, initial } = useAnimatedNumber<HTMLSpanElement>(total, money)
  return (
    <div className={`shrink-0 text-right leading-none ${className}`}>
      <span className="block text-[10.5px] text-mute">
        {count} {count === 1 ? 'seat' : 'seats'}
      </span>
      <span ref={ref} className="num mt-1 block text-[19px] font-medium tracking-[-0.03em]">
        {initial}
      </span>
    </div>
  )
}
