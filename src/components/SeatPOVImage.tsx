import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { MOVIE } from '../data/cinema'
import { prefersReducedMotion } from '../lib/gsap'
import type { Auditorium } from '../three/auditorium'

export interface SeatPOVHandle {
  /** Builds the hall on first call. Resolves null when WebGL is unavailable. */
  ensure: () => Promise<Auditorium | null>
  current: () => Auditorium | null
}

interface Props {
  ref: Ref<SeatPOVHandle>
  /** Called after the canvas has been resized, so the caller can re-pose the camera. */
  onResize?: () => void
}

/** The point-of-view picture. It is rendered live from a model of the hall, so
 *  the three.js bundle is only fetched once somebody has picked a seat. */
export function SeatPOVImage({ ref, onResize }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const auditorium = useRef<Auditorium | null>(null)
  const pending = useRef<Promise<Auditorium | null> | null>(null)
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useImperativeHandle(ref, () => ({
    current: () => auditorium.current,
    ensure() {
      if (!pending.current) {
        pending.current = import('../three/auditorium')
          .then(({ Auditorium }) => {
            const canvas = canvasRef.current
            if (!canvas) return null
            const hall = new Auditorium(canvas, MOVIE.still, {
              reducedMotion: prefersReducedMotion(),
              onReady: () => setReady(true),
            })
            auditorium.current = hall
            return hall
          })
          .catch(() => {
            setFailed(true)
            return null
          })
      }
      return pending.current
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!auditorium.current || !canvas.clientWidth) return
        auditorium.current.resize()
        onResizeRef.current?.()
      })
    })
    observer.observe(canvas)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      auditorium.current?.dispose()
      auditorium.current = null
      pending.current = null
    }
  }, [])

  return (
    <>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Live view of the screen from the selected seat"
        className={`absolute inset-0 block h-full w-full transition-opacity duration-700 ${ready && !failed ? 'opacity-100' : 'opacity-0'}`}
      />
      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-obsidian">
          <img
            src={MOVIE.poster}
            alt=""
            className="w-[min(86vw,1100px)] rounded-md object-cover shadow-[0_0_120px_rgb(90_130_255/0.35)] [aspect-ratio:2.39]"
          />
          <p className="absolute bottom-[46%] text-[12px] text-mute lg:bottom-[30%]">
            3D preview isn’t available on this device.
          </p>
        </div>
      )}
    </>
  )
}
