import { memo, useEffect, useRef } from 'react'
import { CATEGORY, money } from '../data/cinema'
import { gsap, prefersReducedMotion } from '../lib/gsap'
import type { Seat } from '../types'

export type SeatState = 'available' | 'selected' | 'occupied'

interface Props {
  seat: Seat
  state: SeatState
  onToggle: (id: string) => void
}

/** One chair on the map. Memoised so toggling a seat re-renders only that seat. */
export const CinemaSeat = memo(function CinemaSeat({ seat, state, onToggle }: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const ringRef = useRef<HTMLSpanElement>(null)
  const previous = useRef(state)

  useEffect(() => {
    const was = previous.current
    previous.current = state
    const button = buttonRef.current
    if (!button || was === state || prefersReducedMotion()) return
    if (state === 'selected') {
      gsap.fromTo(
        button,
        { scale: 0.62 },
        { scale: 1, duration: 0.9, ease: 'elastic.out(1.1, 0.45)', clearProps: 'transform', overwrite: true },
      )
      gsap.fromTo(
        ringRef.current,
        { scale: 0.8, opacity: 0.9 },
        { scale: 3.2, opacity: 0, duration: 0.9, ease: 'expo.out', overwrite: true },
      )
    } else if (was === 'selected') {
      gsap.fromTo(
        button,
        { scale: 1.18 },
        { scale: 1, duration: 0.45, ease: 'power3.out', clearProps: 'transform', overwrite: true },
      )
    }
  }, [state])

  // Rows bow toward the screen at the edges, and chairs turn to face it.
  const lift = -(seat.xNorm * seat.xNorm) * 0.62
  const turn = -seat.xNorm * 9
  const occupied = state === 'occupied'

  return (
    <span
      className="relative block"
      style={{ transform: `translateY(calc(var(--u) * ${lift.toFixed(3)})) rotate(${turn.toFixed(2)}deg)` }}
    >
      <span
        ref={ringRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full opacity-0 shadow-[0_0_0_1.5px_var(--color-accent)]"
      />
      <button
        ref={buttonRef}
        type="button"
        className="seat"
        data-seat-id={seat.id}
        data-state={state}
        data-category={seat.category}
        aria-pressed={state === 'selected'}
        aria-disabled={occupied}
        aria-label={`Row ${seat.row}, seat ${seat.number}, ${CATEGORY[seat.category].label}, ${occupied ? 'taken' : money(seat.price)}`}
        onClick={() => {
          if (!occupied) onToggle(seat.id)
        }}
      >
        <span className="num pointer-events-none relative z-10">{seat.number}</span>
      </button>
    </span>
  )
})
