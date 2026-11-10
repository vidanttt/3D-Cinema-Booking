import { useLayoutEffect, useRef } from 'react'
import { CINEMA, SESSIONS } from '../data/cinema'
import { gsap, prefersReducedMotion } from '../lib/gsap'

interface Props {
  value: string
  onChange: (id: string) => void
}

/** Segmented showtime control with a glass thumb that slides between options. */
export function SessionSelector({ value, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLSpanElement>(null)
  const first = useRef(true)

  useLayoutEffect(() => {
    const track = trackRef.current
    const thumb = thumbRef.current
    if (!track || !thumb) return
    const place = (animate: boolean) => {
      const active = track.querySelector<HTMLElement>('[aria-checked="true"]')
      if (!active) return
      gsap.to(thumb, {
        x: active.offsetLeft,
        width: active.offsetWidth,
        duration: animate && !prefersReducedMotion() ? 0.65 : 0,
        ease: 'expo.out',
        overwrite: true,
      })
    }
    place(!first.current)
    first.current = false
    const observer = new ResizeObserver(() => place(false))
    observer.observe(track)
    return () => observer.disconnect()
  }, [value])

  return (
    <div data-anim="info-item">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="eyebrow text-mute">Showtime</span>
        <span className="text-[12.5px] text-mute">{CINEMA.date}</span>
      </div>
      <div
        ref={trackRef}
        role="radiogroup"
        aria-label="Showtime"
        className="relative grid grid-cols-3 rounded-[22px] bg-white/[0.045] p-1 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07),inset_0_1px_0_rgb(255_255_255/0.06)]"
      >
        <span
          ref={thumbRef}
          aria-hidden
          className="glass glass-thin pointer-events-none !absolute left-0 top-1 h-[calc(100%-0.5rem)] rounded-[18px]"
        />
        {SESSIONS.map((s) => {
          const active = s.id === value
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(s.id)}
              className={`relative z-10 flex flex-col items-center gap-0.5 rounded-[18px] px-2 py-2.5 transition-colors duration-300 ${active ? 'text-ink' : 'text-mute hover:text-ink/80'}`}
            >
              <span className="num text-[17px] font-medium tracking-[-0.03em]">{s.time}</span>
              <span className="text-[10.5px] uppercase tracking-[0.08em] opacity-70">{s.format}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
