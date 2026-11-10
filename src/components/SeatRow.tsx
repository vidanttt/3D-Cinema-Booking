import { memo } from 'react'
import { MAP_COLS } from '../data/seats'
import type { Seat } from '../types'
import { CinemaSeat, type SeatState } from './CinemaSeat'

interface Props {
  label: string
  seats: Seat[]
  selected: ReadonlySet<string>
  occupied: ReadonlySet<string>
  onToggle: (id: string) => void
  /** Extra legroom before this row (cross-aisle). */
  spaced?: boolean
}

const COLS = Array.from({ length: MAP_COLS }, (_, i) => i)
const AISLE_AFTER = new Set([2, 10])

export const SeatRow = memo(function SeatRow({ label, seats, selected, occupied, onToggle, spaced }: Props) {
  const byCol = new Map(seats.map((s) => [s.col, s]))
  const rowLabel = (
    <span className="eyebrow w-[calc(var(--u)*1.1)] shrink-0 text-center !text-[clamp(8px,calc(var(--u)*0.34),11px)] !tracking-normal text-mute/70">
      {label}
    </span>
  )
  return (
    <div
      data-row
      role="group"
      aria-label={`Row ${label}`}
      className="flex items-center justify-center gap-[calc(var(--u)*0.26)]"
      style={spaced ? { marginTop: 'calc(var(--u) * 0.5)' } : undefined}
    >
      {rowLabel}
      <span aria-hidden className="w-[calc(var(--u)*0.14)]" />
      {COLS.map((col) => {
        const seat = byCol.get(col)
        const state: SeatState = !seat
          ? 'available'
          : selected.has(seat.id)
            ? 'selected'
            : occupied.has(seat.id)
              ? 'occupied'
              : 'available'
        return (
          <span key={col} className={`block ${AISLE_AFTER.has(col) ? 'mr-[calc(var(--u)*1.04)]' : ''}`}>
            {seat ? (
              <CinemaSeat seat={seat} state={state} onToggle={onToggle} />
            ) : (
              <span aria-hidden className="block w-[var(--u)]" />
            )}
          </span>
        )
      })}
      <span aria-hidden className="w-[calc(var(--u)*0.14)]" />
      {rowLabel}
    </div>
  )
})
