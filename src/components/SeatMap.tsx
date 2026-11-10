import { useEffect, useLayoutEffect, useMemo, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { ROWS, SEATS_BY_ROW, SEAT_BY_ID, neighbour, type Direction } from '../data/seats'
import { finePointer, gsap, prefersReducedMotion } from '../lib/gsap'
import { SeatRow } from './SeatRow'
import { SeatTooltip, type SeatTooltipHandle } from './SeatTooltip'

interface Props {
  sessionId: string
  selected: readonly string[]
  occupied: ReadonlySet<string>
  onToggle: (id: string) => void
}

const ARROWS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'forward', ArrowDown: 'back' }
const NONE: ReadonlySet<string> = new Set()

export function SeatMap({ sessionId, selected, occupied, onToggle }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lightRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<SeatTooltipHandle>(null)
  const hovered = useRef<string | null>(null)
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const occupiedRef = useRef(occupied)
  occupiedRef.current = occupied

  // Re-seat the house when the showtime changes.
  const firstSession = useRef(sessionId)
  useLayoutEffect(() => {
    if (firstSession.current === sessionId) return
    firstSession.current = sessionId
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return
    const tween = gsap.fromTo(
      root.querySelectorAll('[data-row]'),
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.035, ease: 'expo.out', clearProps: 'transform,opacity,visibility' },
    )
    return () => {
      tween.kill()
    }
  }, [sessionId])

  // A soft pool of light that follows the cursor across the seats.
  useEffect(() => {
    const root = rootRef.current
    const light = lightRef.current
    if (!root || !light || !finePointer() || prefersReducedMotion()) return
    const xTo = gsap.quickTo(light, 'x', { duration: 0.6, ease: 'power3.out' })
    const yTo = gsap.quickTo(light, 'y', { duration: 0.6, ease: 'power3.out' })
    const move = (e: globalThis.PointerEvent) => {
      const r = root.getBoundingClientRect()
      xTo(e.clientX - r.left)
      yTo(e.clientY - r.top)
    }
    const enter = () => gsap.to(light, { opacity: 1, duration: 0.6 })
    const leave = () => gsap.to(light, { opacity: 0, duration: 0.8 })
    root.addEventListener('pointermove', move)
    root.addEventListener('pointerenter', enter)
    root.addEventListener('pointerleave', leave)
    return () => {
      root.removeEventListener('pointermove', move)
      root.removeEventListener('pointerenter', enter)
      root.removeEventListener('pointerleave', leave)
      gsap.killTweensOf(light)
    }
  }, [])

  const handleOver = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-seat-id]')
    const id = el?.dataset.seatId ?? null
    if (id === hovered.current) return
    hovered.current = id
    const seat = id ? SEAT_BY_ID.get(id) : undefined
    if (el && seat) tooltipRef.current?.show(seat, el.getBoundingClientRect(), occupiedRef.current.has(seat.id))
    else tooltipRef.current?.hide()
  }
  const handleLeave = () => {
    hovered.current = null
    tooltipRef.current?.hide()
  }

  // Arrow keys walk the house, seat to seat.
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const direction = ARROWS[e.key]
    const id = (e.target as HTMLElement).dataset?.seatId
    const seat = id ? SEAT_BY_ID.get(id) : undefined
    if (!direction || !seat) return
    e.preventDefault()
    const next = neighbour(seat, direction, NONE)
    if (next) rootRef.current?.querySelector<HTMLElement>(`[data-seat-id="${next.id}"]`)?.focus()
  }

  return (
    <div
      ref={rootRef}
      onKeyDown={handleKey}
      data-anim="map"
      className="seatmap relative mx-auto w-full max-w-[860px]"
      onPointerOver={handleOver}
      onPointerLeave={handleLeave}
    >
      <div
        ref={lightRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 -ml-[170px] -mt-[170px] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.075),transparent_65%)] opacity-0"
      />
      <div
        role="group"
        aria-label="Seat map. The screen is at the top."
        className="seatmap-inner flex flex-col gap-[calc(var(--u)*0.44)] pb-[calc(var(--u)*0.4)] pt-[calc(var(--u)*0.9)]"
      >
        {SEATS_BY_ROW.map((seats, r) => (
          <SeatRow
            key={ROWS[r]}
            label={ROWS[r]}
            seats={seats}
            selected={selectedSet}
            occupied={occupied}
            onToggle={onToggle}
            spaced={r === 8}
          />
        ))}
      </div>
      <SeatTooltip ref={tooltipRef} />
    </div>
  )
}
