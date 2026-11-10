import { memo, useLayoutEffect, useRef, type MouseEvent } from 'react'
import { HALL, SEATS } from '../data/seats'
import { gsap, prefersReducedMotion } from '../lib/gsap'
import type { Seat } from '../types'

interface Props {
  active: Seat
  selected: readonly string[]
  occupied: ReadonlySet<string>
  /** Jump to another seat's view. */
  onPick: (id: string) => void
  className?: string
}

const HALF = HALL.screenWidth / 2
const VIEW = { x: -7.7, y: -1.1, w: 15.4, h: 18.6 }

/** Plan of the hall with the sightline from the active seat to the screen. */
export const MiniMap = memo(function MiniMap({ active, selected, occupied, onPick, className = '' }: Props) {
  const coneRef = useRef<SVGPolygonElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const pos = useRef({ x: active.xPosition, z: active.zPosition })

  useLayoutEffect(() => {
    const apply = () => {
      const { x, z } = pos.current
      coneRef.current?.setAttribute('points', `${-HALF},0 ${HALF},0 ${x.toFixed(3)},${z.toFixed(3)}`)
      ringRef.current?.setAttribute('cx', x.toFixed(3))
      ringRef.current?.setAttribute('cy', z.toFixed(3))
    }
    if (prefersReducedMotion()) {
      pos.current = { x: active.xPosition, z: active.zPosition }
      apply()
      return
    }
    apply()
    const tween = gsap.to(pos.current, {
      x: active.xPosition,
      z: active.zPosition,
      duration: 0.9,
      ease: 'expo.out',
      onUpdate: apply,
    })
    return () => {
      tween.kill()
    }
  }, [active])

  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    const id = (e.target as SVGElement).dataset.id
    if (id && !occupied.has(id)) onPick(id)
  }

  return (
    <svg
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      className={`block ${className}`}
      role="img"
      aria-label={`Plan of the hall. Row ${active.row}, seat ${active.number} is highlighted.`}
      onClick={handleClick}
    >
      <defs>
        <linearGradient id="mini-cone" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="17">
          <stop offset="0" stopColor="#a4f27a" stopOpacity="0.42" />
          <stop offset="1" stopColor="#a4f27a" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <polygon ref={coneRef} fill="url(#mini-cone)" />
      <path d={`M${-HALF} 0 Q0 -0.9 ${HALF} 0`} fill="none" stroke="#dfe8ff" strokeWidth="0.26" strokeLinecap="round" />
      {SEATS.map((seat) => {
        const taken = occupied.has(seat.id)
        const picked = selected.includes(seat.id)
        return (
          <g key={seat.id}>
            <circle
              cx={seat.xPosition}
              cy={seat.zPosition}
              r={seat.id === active.id ? 0.34 : 0.25}
              fill={picked ? '#a4f27a' : taken ? '#6a2535' : '#f4f3f0'}
              fillOpacity={picked ? 1 : taken ? 0.85 : 0.26}
            />
            {!taken && (
              <circle
                data-id={seat.id}
                cx={seat.xPosition}
                cy={seat.zPosition}
                r={0.36}
                fill="transparent"
                className="cursor-pointer"
              />
            )}
          </g>
        )
      })}
      <circle ref={ringRef} r="0.62" fill="none" stroke="#a4f27a" strokeWidth="0.11" pointerEvents="none" />
    </svg>
  )
})
