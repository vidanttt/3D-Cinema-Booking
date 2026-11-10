import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/gsap'

/** Tweens a number straight into the DOM, without re-rendering React. */
export function useAnimatedNumber<T extends HTMLElement>(value: number, format: (n: number) => string, duration = 0.7) {
  const ref = useRef<T>(null)
  const current = useRef({ v: value })
  const formatRef = useRef(format)
  formatRef.current = format

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const state = current.current
    if (prefersReducedMotion() || state.v === value) {
      state.v = value
      el.textContent = formatRef.current(value)
      return
    }
    const tween = gsap.to(state, {
      v: value,
      duration,
      ease: 'expo.out',
      onUpdate: () => {
        el.textContent = formatRef.current(state.v)
      },
    })
    return () => {
      tween.kill()
    }
  }, [value, duration])

  return { ref, initial: format(current.current.v) }
}
