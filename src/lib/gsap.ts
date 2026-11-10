import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(Flip, ScrollTrigger)
gsap.defaults({ ease: 'power3.out', duration: 0.8 })

export { gsap, Flip, ScrollTrigger }

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const finePointer = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

// Lets animation be paused and scrubbed from the console while developing.
if (import.meta.env.DEV) (window as unknown as { gsap: typeof gsap }).gsap = gsap
