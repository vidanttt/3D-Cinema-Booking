import { useLayoutEffect, useRef } from 'react'
import { CATEGORY, money, pad2 } from '../data/cinema'
import { previewFor } from '../data/pov'
import { SIDE_LABEL, offsetLabel } from '../data/seats'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import { gsap, prefersReducedMotion } from '../lib/gsap'
import type { Seat } from '../types'

function Stat({ label, value, format }: { label: string; value: number; format: (n: number) => string }) {
  const { ref, initial } = useAnimatedNumber<HTMLSpanElement>(value, format)
  return (
    <div className="min-w-0">
      <dt className="eyebrow !text-[9.5px] !tracking-[0.16em] text-mute">{label}</dt>
      <dd className="mt-1 text-[19px] font-medium leading-none tracking-[-0.03em] lg:text-[22px]">
        <span ref={ref} className="num">
          {initial}
        </span>
      </dd>
    </div>
  )
}

/** Who you are in the room: seat, category, and what the view is like. */
export function SeatIdentity({ seat }: { seat: Seat }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const preview = previewFor(seat)

  // The copy rolls over when you move to another seat.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return
    const tween = gsap.fromTo(
      root.querySelectorAll('[data-swap]'),
      { y: 10, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.05, ease: 'expo.out', clearProps: 'transform,opacity,visibility' },
    )
    return () => {
      tween.kill()
    }
  }, [seat.id])

  return (
    <div ref={rootRef} className="min-w-0">
      <p data-swap className="eyebrow flex items-center gap-2 text-accent">
        <span className="live-dot" aria-hidden />
        {preview.label}
        <span className="text-mute">· {SIDE_LABEL[preview.horizontalPosition]}</span>
      </p>
      <h2 data-swap className="mt-2 flex items-baseline gap-3" aria-live="polite">
        <span className="num text-[44px] font-medium leading-[0.9] tracking-[-0.05em] lg:text-[52px]">
          {seat.row}
          {pad2(seat.number)}
        </span>
        <span className="text-[12.5px] leading-tight text-mute">
          {CATEGORY[seat.category].label}
          <br />
          <span className="num text-ink">{money(seat.price)}</span>
        </span>
      </h2>
      <p data-swap className="mt-2.5 hidden max-w-[30ch] text-[12.5px] leading-[1.45] text-mute xl:block">
        {preview.description}
      </p>
    </div>
  )
}

export function SeatStats({ seat }: { seat: Seat }) {
  return (
    <div className="min-w-0">
      <dl className="grid grid-cols-3 gap-4 lg:gap-6">
        <Stat label="Distance" value={seat.distanceFromScreen} format={(n) => `${n.toFixed(1)} m`} />
        <Stat label="Screen fills" value={seat.viewingAngle} format={(n) => `${Math.round(n)}°`} />
        <Stat label="Sightline" value={seat.sightline} format={(n) => `${Math.round(n)}`} />
      </dl>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div
            className="h-full origin-left rounded-full bg-gradient-to-r from-accent/50 to-accent transition-transform duration-700 ease-[var(--ease-expo)]"
            style={{ transform: `scaleX(${seat.sightline / 100})` }}
          />
        </div>
        <span className="shrink-0 text-[11px] text-mute">{offsetLabel(seat)}</span>
      </div>
    </div>
  )
}
