import { useImperativeHandle, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORY, money, pad2 } from '../data/cinema'
import { previewFor } from '../data/pov'
import { gsap } from '../lib/gsap'
import type { Seat } from '../types'

export interface SeatTooltipHandle {
  show: (seat: Seat, anchor: DOMRect, taken: boolean) => void
  hide: () => void
}

/** A single floating glass tooltip, moved imperatively so hovering never
 *  re-renders the seat map. */
export function SeatTooltip({ ref }: { ref: Ref<SeatTooltipHandle> }) {
  const elRef = useRef<HTMLDivElement>(null)
  const [content, setContent] = useState<{ seat: Seat; taken: boolean } | null>(null)
  const visible = useRef(false)

  useImperativeHandle(ref, () => ({
    show(seat, anchor, taken) {
      const el = elRef.current
      if (!el) return
      setContent({ seat, taken })
      const x = Math.min(window.innerWidth - 120, Math.max(120, anchor.left + anchor.width / 2))
      const y = anchor.top - 12
      if (visible.current) {
        gsap.to(el, { x, y, autoAlpha: 1, scale: 1, duration: 0.35, ease: 'expo.out', overwrite: true })
      } else {
        gsap.set(el, { x, y: y + 6, scale: 0.94 })
        gsap.to(el, { y, autoAlpha: 1, scale: 1, duration: 0.35, ease: 'expo.out', overwrite: true })
      }
      visible.current = true
    },
    hide() {
      visible.current = false
      if (elRef.current) gsap.to(elRef.current, { autoAlpha: 0, scale: 0.96, duration: 0.2, ease: 'power2.out', overwrite: true })
    },
  }))

  const seat = content?.seat
  return createPortal(
    <div ref={elRef} role="tooltip" className="pointer-events-none invisible fixed left-0 top-0 z-[60] opacity-0">
      <div className="glass glass-thin -translate-x-1/2 -translate-y-full rounded-2xl px-3.5 py-2.5 text-[12px] whitespace-nowrap">
        {seat && (
          <>
            <div className="flex items-baseline gap-2.5">
              <span className="num text-[15px] font-medium tracking-[-0.02em]">
                {seat.row}
                {pad2(seat.number)}
              </span>
              <span className="text-mute">{CATEGORY[seat.category].label}</span>
              <span className={`num ml-auto pl-3 ${content.taken ? 'text-[#d98a9c]' : 'text-accent'}`}>
                {content.taken ? 'Taken' : money(seat.price)}
              </span>
            </div>
            <div className="num mt-1 text-[11px] text-mute">
              {previewFor(seat).label} · {seat.distanceFromScreen.toFixed(1)} m · {Math.round(seat.viewingAngle)}°
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
