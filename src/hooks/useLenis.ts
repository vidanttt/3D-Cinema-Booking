import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger, prefersReducedMotion } from '../lib/gsap'

/** One Lenis instance for the document, driven by the GSAP ticker and kept in
 *  step with ScrollTrigger. */
export function useLenis() {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const lenis = new Lenis({ lerp: 0.11, smoothWheel: true })
    lenisRef.current = lenis
    const onScroll = () => ScrollTrigger.update()
    const tick = (time: number) => lenis.raf(time * 1000)
    lenis.on('scroll', onScroll)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      lenis.off('scroll', onScroll)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return lenisRef
}
