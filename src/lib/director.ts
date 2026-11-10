import { heroPose, overheadPose, seatPose, type PlanRegistration } from '../data/pov'
import { HALL } from '../data/seats'
import type { Auditorium } from '../three/auditorium'
import type { Seat } from '../types'
import { Flip, gsap, prefersReducedMotion } from './gsap'

/**
 * The director owns every stage-to-stage transition. React decides *what* is on
 * screen; these timelines decide how it gets there. Each function returns its
 * timeline and calls `onComplete` when the room has settled.
 */

/** Seat width + gap on the 2D map, in seat widths. */
const MAP_PITCH = 1.26

function parts() {
  const preview = document.getElementById('preview') as HTMLElement
  const all = (selector: string) => Array.from(preview.querySelectorAll<HTMLElement>(selector))
  return {
    preview,
    pov: preview.querySelector<HTMLElement>('[data-anim="pov"]')!,
    picture: preview.querySelector<HTMLElement>('[data-anim="pov-picture"]')!,
    panel: document.getElementById('seat-panel') as HTMLElement,
    dock: document.getElementById('dock') as HTMLElement,
    stage: document.getElementById('stage') as HTMLElement,
    ui: all('[data-anim="pov-ui"]'),
    items: all('[data-anim="panel-item"]'),
    ticket: preview.querySelector<HTMLElement>('[data-anim="ticket"]'),
    ticketItems: all('[data-anim="ticket-item"]'),
  }
}

/** Where a seat sits on the 2D map right now, so the 3D plan view can be laid
 *  exactly over it. */
function registration(seat: Seat): PlanRegistration & { radius: number } {
  const width = window.innerWidth
  const height = window.innerHeight
  const el = document.querySelector<HTMLElement>(`[data-seat-id="${seat.id}"]`)
  const r = el?.getBoundingClientRect() ?? new DOMRect(width / 2 - 16, height / 2 - 16, 32, 32)
  return {
    width,
    height,
    x: r.left + r.width / 2,
    y: r.top + r.height / 2,
    metresPerPx: HALL.seatPitch / (r.width * MAP_PITCH),
    radius: r.width * 0.5,
  }
}

const circle = (r: number, x: number, y: number) => `circle(${r.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`
const cover = (v: PlanRegistration) => Math.hypot(Math.max(v.x, v.width - v.x), Math.max(v.y, v.height - v.y)) + 8

function play(tl: gsap.core.Timeline) {
  if (prefersReducedMotion()) tl.progress(1)
  return tl
}

/** Page load: the house lights come up. */
export function intro(scope: HTMLElement) {
  if (prefersReducedMotion()) return
  const $ = gsap.utils.selector(scope)
  const poster = $('[data-anim="poster"]')
  const posterImg = $('[data-anim="poster-img"]')

  gsap
    .timeline({ defaults: { ease: 'expo.out' } })
    .from($('[data-anim="header"]'), { y: -28, autoAlpha: 0, duration: 1.1 }, 0.1)
    .fromTo(
      poster,
      { clipPath: 'inset(100% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', clearProps: 'clipPath' },
      0.1,
    )
    .from(posterImg, { scale: 1.35, duration: 2 }, 0.1)
    .from($('[data-anim="info-item"]'), { y: 28, autoAlpha: 0, duration: 1.1, stagger: 0.07 }, 0.5)
    .from($('[data-anim="map-head"]'), { y: 18, autoAlpha: 0, duration: 1 }, 0.5)
    .from($('[data-anim="screen"]'), { autoAlpha: 0, scaleX: 0.55, y: -14, duration: 1.6 }, 0.35)
    .from(
      $('[data-row]'),
      { autoAlpha: 0, y: 34, scale: 0.93, duration: 1, stagger: 0.055, clearProps: 'transform,opacity,visibility' },
      0.65,
    )
    .from($('[data-anim="legend"]'), { autoAlpha: 0, y: 12, duration: 0.9 }, 1.3)
    .from($('[data-anim="dock"]'), { yPercent: 130, autoAlpha: 0, duration: 1.2, clearProps: 'transform,opacity,visibility' }, 1.15)

  // The still drifts inside its frame as the page scrolls.
  gsap.to(posterImg, {
    yPercent: 5,
    ease: 'none',
    scrollTrigger: { trigger: poster, start: 'top bottom', end: 'bottom top', scrub: true },
  })
}

/** Seat map → view from the seat. The 3D hall opens through the chosen seat as
 *  a plan view registered to the map, then the camera drops into the chair
 *  while the dock morphs into the seat panel. */
export function toPreview(aud: Auditorium | null, seat: Seat, onComplete: () => void) {
  const p = parts()
  const view = registration(seat)
  const state = Flip.getState(p.dock)

  p.preview.style.display = 'block'
  p.panel.style.display = 'block'

  if (aud) {
    aud.resize()
    aud.lifeTarget.value = 0
    aud.glowTarget.intensity = 0
    aud.jumpTo(overheadPose(seat, view))
    aud.start()
  }

  const tl = gsap.timeline({ onComplete })
  tl.fromTo(
    p.pov,
    { clipPath: circle(view.radius, view.x, view.y) },
    { clipPath: circle(cover(view), view.x, view.y), duration: 1.25, ease: 'power3.inOut' },
    0,
  )
    .set(p.pov, { clearProps: 'clipPath' })
    .to(p.stage, { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut' }, 0.3)
    // The panel starts as the dock's exact footprint and grows out of it,
    // while the dock itself dissolves on top.
    .add(Flip.from(state, { targets: p.panel, duration: 1.15, ease: 'expo.inOut', scale: false }), 0)
    .to(p.dock, { autoAlpha: 0, duration: 0.4, ease: 'power2.out' }, 0)
    .set(p.dock, { display: 'none', clearProps: 'opacity,visibility' }, 0.45)
    .fromTo(
      p.items,
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out' },
      0.95,
    )
    .fromTo(
      p.ui,
      { autoAlpha: 0, y: -16 },
      { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08, ease: 'expo.out' },
      1.5,
    )
  if (aud) {
    tl.add(aud.flyTo(seatPose(seat, aud.aspect), { duration: 2.3, ease: 'power3.inOut' }), 0.3)
    tl.to(aud.lifeTarget, { value: 1, duration: 1.6, ease: 'power2.inOut' }, 2.2)
  }
  return play(tl)
}

/** View → seat map. The camera rises back to the plan and the picture closes
 *  onto the seat it came from. */
export function toSelect(aud: Auditorium | null, seat: Seat, onComplete: () => void) {
  const p = parts()
  const view = registration(seat)
  const reduced = prefersReducedMotion()
  const dockWrap = p.dock.parentElement

  const tl = gsap.timeline({
    onComplete: () => {
      aud?.stop()
      p.preview.style.display = 'none'
      gsap.set([p.pov, p.panel, ...p.ui, ...p.items], { clearProps: 'all' })
      p.panel.style.display = 'none'
      onComplete()
    },
  })
  tl.to(p.ui, { autoAlpha: 0, y: -12, duration: 0.35, ease: 'power2.in', stagger: 0.04 }, 0)
    .to(p.items, { autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, 0)
    .add(() => {
      // The emptied panel shrinks onto the dock's footprint, then hands over.
      p.dock.style.display = ''
      if (dockWrap) dockWrap.style.opacity = '0'
      // Both are centred on the same baseline, so matching the size is enough.
      const target = p.dock.getBoundingClientRect()
      gsap.to(p.panel, {
        width: target.width,
        height: target.height,
        borderRadius: getComputedStyle(p.dock).borderRadius,
        duration: reduced ? 0 : 0.9,
        ease: 'expo.inOut',
      })
    }, 0.25)
    .fromTo(
      dockWrap,
      { opacity: 0 },
      { opacity: 1, duration: 0.4, ease: 'power2.out', immediateRender: false, clearProps: 'opacity' },
      1.0,
    )
    .set(p.panel, { autoAlpha: 0 }, 1.4)
    .to(p.stage, { autoAlpha: 1, duration: 0.8, ease: 'power2.out' }, 0.8)
    .fromTo(
      p.pov,
      { clipPath: circle(cover(view), view.x, view.y) },
      { clipPath: circle(view.radius, view.x, view.y), duration: 1.05, ease: 'power3.inOut', immediateRender: false },
      0.75,
    )
    .to(p.pov, { autoAlpha: 0, duration: 0.25, ease: 'power1.out' }, '>-0.12')
  if (aud) {
    tl.to(aud.lifeTarget, { value: 0, duration: 0.4, ease: 'power2.out' }, 0)
    tl.add(aud.flyTo(overheadPose(seat, view), { duration: 1.55, ease: 'power3.inOut' }), 0.1)
  }
  return play(tl)
}

/** Booked: pull back to the rear of the house and present the ticket. */
export function confirm(aud: Auditorium | null, onComplete: () => void) {
  const p = parts()
  const tl = gsap.timeline({ onComplete })
  tl.to(p.panel, { autoAlpha: 0, y: 40, duration: 0.55, ease: 'power3.in' }, 0).set(p.panel, { display: 'none' })
  if (p.ticket) {
    tl.fromTo(
      p.ticket,
      { autoAlpha: 0, y: 80, scale: 0.9, rotationX: -16, transformOrigin: '50% 100%' },
      { autoAlpha: 1, y: 0, scale: 1, rotationX: 0, duration: 1.4, ease: 'expo.out' },
      0.9,
    ).fromTo(
      p.ticketItems,
      { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out' },
      1.15,
    )
  }
  if (aud) {
    tl.to(aud.lifeTarget, { value: 0.4, duration: 0.5 }, 0)
    tl.add(aud.flyTo(heroPose(aud.aspect), { duration: 2.4, ease: 'power3.inOut' }), 0.1)
    tl.to(aud.glowTarget, { intensity: 2.6, duration: 1.6, ease: 'power2.out' }, 0.9)
  }
  return play(tl)
}

/** Ticket away, lights down, back to the map with the new seats marked taken.
 *  `swap` runs while everything is hidden; it commits the booking to state. */
export function finish(aud: Auditorium | null, swap: () => void, onComplete: () => void) {
  const p = parts()
  const dockWrap = p.dock.parentElement
  const tl = gsap.timeline({
    onComplete: () => {
      aud?.stop()
      if (aud) {
        aud.lifeTarget.value = 0
        aud.glowTarget.intensity = 0
      }
      p.preview.style.display = 'none'
      p.panel.style.display = 'none'
      gsap.set([p.pov, p.picture, p.panel, ...p.ui, ...p.items], { clearProps: 'all' })
      p.panel.style.display = 'none'
      onComplete()
    },
  })
  if (p.ticket) tl.to(p.ticket, { autoAlpha: 0, y: -36, scale: 0.96, duration: 0.5, ease: 'power3.in' }, 0)
  tl.to(p.ui, { autoAlpha: 0, duration: 0.4 }, 0)
    .to(p.picture, { autoAlpha: 0, duration: 0.6, ease: 'power2.inOut' }, 0.15)
    .add(() => {
      swap()
      p.dock.style.display = ''
      gsap.set(p.stage, { autoAlpha: 1 })
    })
    .to(p.pov, { autoAlpha: 0, duration: 0.8, ease: 'power2.inOut' })
    .fromTo(
      p.stage.querySelectorAll('[data-row]'),
      { autoAlpha: 0, y: 18 },
      { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.035, ease: 'expo.out', clearProps: 'transform,opacity,visibility' },
      '<',
    )
  if (dockWrap) {
    tl.fromTo(
      dockWrap,
      { yPercent: 130 },
      { yPercent: 0, duration: 1, ease: 'expo.out', clearProps: 'transform' },
      '<0.15',
    )
  }
  return play(tl)
}

/** A small shake for "you can't do that". */
export function nudge(el: HTMLElement | null) {
  if (!el || prefersReducedMotion()) return
  gsap.fromTo(el, { x: 0 }, { keyframes: { x: [0, -9, 8, -5, 3, 0] }, duration: 0.5, ease: 'power2.out', overwrite: true })
}
