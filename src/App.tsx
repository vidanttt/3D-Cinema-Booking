import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { BookingDock } from './components/BookingDock'
import { CinemaHeader } from './components/CinemaHeader'
import { CinemaScreen } from './components/CinemaScreen'
import { MovieInformation } from './components/MovieInformation'
import { SeatLegend } from './components/SeatLegend'
import { SeatMap } from './components/SeatMap'
import type { SeatPOVHandle } from './components/SeatPOVImage'
import { SeatPreview } from './components/SeatPreview'
import { SessionSelector } from './components/SessionSelector'
import { CINEMA, MAX_SEATS, MOVIE, SESSIONS } from './data/cinema'
import { heroPose, seatPose } from './data/pov'
import { SEATS, getSeat, neighbour, occupiedFor, type Direction } from './data/seats'
import { useLenis } from './hooks/useLenis'
import * as director from './lib/director'
import { gsap } from './lib/gsap'
import { bookingReducer, initialState } from './state'
import type { Booking } from './types'

const KEY_STEP: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'forward',
  ArrowDown: 'back',
}

function makeReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const pick = () => alphabet[Math.floor(Math.random() * alphabet.length)]
  return `CN-${pick()}${pick()}${pick()}${pick()}-${10 + Math.floor(Math.random() * 90)}`
}

export default function App() {
  const [state, dispatch] = useReducer(bookingReducer, initialState)
  const [loadingView, setLoadingView] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const pov = useRef<SeatPOVHandle>(null)
  /** True while a transition owns the screen. */
  const busy = useRef(false)
  const timer = useRef(0)
  const lenis = useLenis()

  const session = SESSIONS.find((s) => s.id === state.sessionId) ?? SESSIONS[0]
  const occupied = useMemo(() => {
    const base = occupiedFor(session)
    const mine = state.booked[session.id]
    return mine?.length ? new Set([...base, ...mine]) : base
  }, [session, state.booked])
  const seats = useMemo(() => state.selected.map(getSeat), [state.selected])
  const total = seats.reduce((sum, seat) => sum + seat.price, 0)
  const active = state.activeId ? getSeat(state.activeId) : null
  const blocked = useMemo(() => new Set([...occupied, ...state.selected]), [occupied, state.selected])
  const canStep = useMemo(() => {
    const can = (d: Direction) => !!active && !!neighbour(active, d, blocked)
    return { left: can('left'), right: can('right'), forward: can('forward'), back: can('back') }
  }, [active, blocked])

  // Latest values for handlers that must keep a stable identity.
  const live = useRef({ state, occupied, active, blocked, total })
  live.current = { state, occupied, active, blocked, total }

  const lockScroll = (locked: boolean) => {
    if (locked) lenis.current?.stop()
    else lenis.current?.start()
    document.documentElement.classList.toggle('scroll-lock', locked)
  }

  /* ---------- entrance ---------- */

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const ctx = gsap.context(() => director.intro(root), root)
    return () => ctx.revert()
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  /* ---------- 3D hall ---------- */

  const syncHall = () => {
    const { state, occupied } = live.current
    pov.current?.current()?.setSeatStates(state.selected, state.activeId, occupied)
  }

  useEffect(syncHall, [state.selected, state.activeId, occupied])

  // Build the hall quietly once somebody shows interest in a seat.
  const interested = state.selected.length > 0
  useEffect(() => {
    if (!interested) return
    const id = window.setTimeout(() => void pov.current?.ensure().then(syncHall), 450)
    return () => window.clearTimeout(id)
  }, [interested])

  // Moving to another seat while previewing flies the camera there.
  const previousActive = useRef(state.activeId)
  useEffect(() => {
    const previous = previousActive.current
    previousActive.current = state.activeId
    const { state: now, active } = live.current
    if (now.stage !== 'preview' || !active || previous === state.activeId) return
    const hall = pov.current?.current()
    hall?.flyTo(seatPose(active, hall.aspect), { duration: 1.15, ease: 'power3.inOut' })
  }, [state.activeId])

  const handleResize = useCallback(() => {
    const hall = pov.current?.current()
    const { state, active } = live.current
    if (!hall || busy.current) return
    if (state.stage === 'preview' && active) hall.jumpTo(seatPose(active, hall.aspect))
    else if (state.stage === 'confirmed') hall.jumpTo(heroPose(hall.aspect))
  }, [])

  const handlePointer = useCallback((x: number, y: number) => pov.current?.current()?.setPointer(x, y), [])

  /* ---------- actions ---------- */

  const toggle = useCallback((id: string) => {
    const { state } = live.current
    if (busy.current || state.stage !== 'select') return
    if (!state.selected.includes(id) && state.selected.length >= MAX_SEATS) {
      director.nudge(document.getElementById('dock'))
      return
    }
    dispatch({ type: 'toggle', id })
  }, [])

  const openPreview = useCallback(async () => {
    if (busy.current || !live.current.active) return
    busy.current = true
    setLoadingView(true)
    const hall = (await pov.current?.ensure()) ?? null
    const seat = live.current.active
    if (!seat) {
      busy.current = false
      setLoadingView(false)
      return
    }
    syncHall()
    flushSync(() => {
      setLoadingView(false)
      dispatch({ type: 'stage', stage: 'preview' })
    })
    lockScroll(true)
    director.toPreview(hall, seat, () => {
      busy.current = false
      document.querySelector<HTMLElement>('#seat-panel [data-autofocus]')?.focus({ preventScroll: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const backToMap = useCallback(() => {
    const { state, active } = live.current
    if (busy.current || state.stage !== 'preview' || !active) return
    busy.current = true
    director.toSelect(pov.current?.current() ?? null, active, () => {
      dispatch({ type: 'stage', stage: 'select' })
      lockScroll(false)
      busy.current = false
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-seat-id="${active.id}"]`)?.focus({ preventScroll: true }),
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const step = useCallback((direction: Direction) => {
    const { state, active, blocked } = live.current
    if (busy.current || state.stage !== 'preview' || !active) return
    const next = neighbour(active, direction, blocked)
    if (next) dispatch({ type: 'swap', to: next.id })
  }, [])

  const pick = useCallback((id: string) => {
    const { state, occupied } = live.current
    if (busy.current || state.stage !== 'preview') return
    if (state.selected.includes(id)) dispatch({ type: 'focus', id })
    else if (!occupied.has(id)) dispatch({ type: 'swap', to: id })
  }, [])

  const confirmBooking = useCallback(() => {
    const { state } = live.current
    if (busy.current || state.stage !== 'preview' || !state.selected.length) return
    busy.current = true
    setConfirming(true)
    // Stands in for the payment round-trip.
    timer.current = window.setTimeout(() => {
      const { state, total } = live.current
      const booking: Booking = {
        reference: makeReference(),
        sessionId: state.sessionId,
        seatIds: state.selected,
        total,
      }
      flushSync(() => {
        setConfirming(false)
        dispatch({ type: 'confirm', booking })
      })
      director.confirm(pov.current?.current() ?? null, () => {
        busy.current = false
        document.querySelector<HTMLElement>('#preview [data-anim="ticket"] [data-autofocus]')?.focus({ preventScroll: true })
      })
    }, 1100)
  }, [])

  const done = useCallback(() => {
    if (busy.current || live.current.state.stage !== 'confirmed') return
    busy.current = true
    director.finish(
      pov.current?.current() ?? null,
      () => flushSync(() => dispatch({ type: 'finish' })),
      () => {
        lockScroll(false)
        busy.current = false
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const { stage } = live.current.state
      if (stage === 'preview') {
        const direction = KEY_STEP[e.key]
        if (direction) {
          e.preventDefault()
          step(direction)
        } else if (e.key === 'Escape') {
          backToMap()
        }
      } else if (stage === 'confirmed' && e.key === 'Escape') {
        done()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, backToMap, done])

  const free = SEATS.length - occupied.size

  return (
    <div ref={rootRef}>
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img
          src={MOVIE.poster}
          alt=""
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-[0.22] blur-[90px] saturate-150"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_68%_8%,rgb(80_115_210/0.2),transparent_70%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-obsidian/30 via-obsidian/75 to-obsidian" />
        <div className="grain absolute inset-0" />
      </div>

      <div id="stage" inert={state.stage !== 'select'}>
        <div id="top" />
        <CinemaHeader session={session} />
        <main className="mx-auto grid max-w-[1400px] gap-7 px-4 pb-48 pt-6 sm:px-8 lg:grid-cols-[minmax(300px,390px)_minmax(0,1fr)] lg:gap-16 lg:pb-40 lg:pt-10">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <MovieInformation>
              <SessionSelector value={state.sessionId} onChange={(id) => dispatch({ type: 'session', id })} />
            </MovieInformation>
          </div>

          <section aria-labelledby="seats-title" className="min-w-0">
            <div data-anim="map-head" className="mb-5 flex items-end justify-between gap-4 lg:mb-2">
              <div>
                <p className="eyebrow text-mute">
                  {CINEMA.hall} · {session.format}
                </p>
                <h2 id="seats-title" className="mt-1.5 text-[22px] font-medium leading-none tracking-[-0.035em] lg:text-[28px]">
                  Choose a seat, <em className="font-serif text-[1.1em] font-normal text-silver">see the view.</em>
                </h2>
              </div>
              <p className="shrink-0 text-right text-[12px] leading-tight text-mute">
                <span className="num text-[15px] text-ink">{free}</span>
                <br />
                seats free
              </p>
            </div>
            <CinemaScreen />
            <SeatMap sessionId={state.sessionId} selected={state.selected} occupied={occupied} onToggle={toggle} />
            <div className="mt-7 lg:mt-9">
              <SeatLegend />
            </div>
          </section>
        </main>
      </div>

      <BookingDock seats={seats} total={total} loading={loadingView} onRemove={toggle} onPreview={openPreview} />

      <SeatPreview
        povRef={pov}
        stage={state.stage}
        session={session}
        seat={active}
        seats={seats}
        occupied={occupied}
        total={total}
        confirming={confirming}
        booking={state.booking}
        canStep={canStep}
        onBack={backToMap}
        onConfirm={confirmBooking}
        onPick={pick}
        onStep={step}
        onDone={done}
        onResize={handleResize}
        onPointer={handlePointer}
      />
    </div>
  )
}
