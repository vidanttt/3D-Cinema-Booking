import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'
import { useRef, type PointerEvent, type Ref } from 'react'
import { CINEMA, MOVIE } from '../data/cinema'
import { SEATS, type Direction } from '../data/seats'
import type { Booking, Seat, Session, Stage } from '../types'
import { BookingActions } from './BookingActions'
import { BookingConfirmation } from './BookingConfirmation'
import { BookingSummary } from './BookingSummary'
import { GlassPanel } from './GlassPanel'
import { MiniMap } from './MiniMap'
import { SeatIdentity, SeatStats } from './SeatInformation'
import { SeatPOVImage, type SeatPOVHandle } from './SeatPOVImage'

interface Props {
  povRef: Ref<SeatPOVHandle>
  stage: Stage
  session: Session
  /** The seat being looked from. */
  seat: Seat | null
  seats: Seat[]
  occupied: ReadonlySet<string>
  total: number
  confirming: boolean
  booking: Booking | null
  canStep: Record<Direction, boolean>
  onBack: () => void
  onConfirm: () => void
  onPick: (id: string) => void
  onStep: (direction: Direction) => void
  onDone: () => void
  onResize: () => void
  onPointer: (x: number, y: number) => void
}

const STEPS: { direction: Direction; label: string; Icon: typeof ArrowUp }[] = [
  { direction: 'left', label: 'View from the seat to the left', Icon: ArrowLeft },
  { direction: 'forward', label: 'View from a row closer to the screen', Icon: ArrowUp },
  { direction: 'back', label: 'View from a row further back', Icon: ArrowDown },
  { direction: 'right', label: 'View from the seat to the right', Icon: ArrowRight },
]

/** Full-screen view from the seat, with a glass panel describing it. The
 *  director animates this in and out; it stays mounted so GSAP Flip can morph
 *  the booking dock into the panel. */
export function SeatPreview(props: Props) {
  const { stage, session, seats, occupied, booking } = props
  const last = useRef<Seat>(SEATS[0])
  if (props.seat) last.current = props.seat
  const seat = last.current
  const selectedIds = seats.map((s) => s.id)

  const handlePointer = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return
    props.onPointer((e.clientX / window.innerWidth) * 2 - 1, 1 - (e.clientY / window.innerHeight) * 2)
  }

  return (
    <div
      id="preview"
      role="dialog"
      aria-modal="true"
      aria-label={`The view from row ${seat.row}, seat ${seat.number}`}
      className="fixed inset-0 z-50 hidden overflow-hidden"
      onPointerMove={handlePointer}
    >
      <div data-anim="pov" className="absolute inset-0 bg-[#040405]">
        <div data-anim="pov-picture" className="absolute inset-0">
          <SeatPOVImage ref={props.povRef} onResize={props.onResize} />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_50%_38%,transparent_55%,rgb(0_0_0/0.55))]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-black/75 via-black/25 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent"
        />
        <div aria-hidden className="grain pointer-events-none absolute inset-0" />
      </div>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
        <button
          data-anim="pov-ui"
          type="button"
          className="btn btn-glass glass-blur h-11 gap-2 pl-3.5 pr-4 text-[13px]"
          onClick={stage === 'confirmed' ? props.onDone : props.onBack}
          disabled={props.confirming}
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden />
          Seat map
        </button>
        <p
          data-anim="pov-ui"
          className="eyebrow absolute left-1/2 hidden -translate-x-1/2 items-center gap-2.5 text-ink/80 md:flex"
        >
          <span className="live-dot" aria-hidden />
          {stage === 'confirmed' ? `${CINEMA.name} · ${CINEMA.hall}` : `Live view · Row ${seat.row} · Seat ${seat.number}`}
        </p>
        <p
          data-anim="pov-ui"
          className="glass-blur flex h-11 items-center gap-2.5 rounded-full bg-white/[0.07] px-4 text-[12.5px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]"
        >
          <span className="max-w-[16ch] truncate text-mute">{MOVIE.title}</span>
          <span className="h-3 w-px bg-white/15" />
          <span className="num">{session.time}</span>
        </p>
      </div>

      {/* Seat panel */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
        <GlassPanel
          id="seat-panel"
          data-flip-id="dock"
          className="pointer-events-auto hidden w-full max-w-[1180px] rounded-[30px] p-4 sm:p-5 lg:rounded-[36px] lg:px-7 lg:py-5"
        >
          <div className="seat-panel-grid">
            <div data-anim="panel-item" className="[grid-area:id]">
              <SeatIdentity seat={seat} />
            </div>
            <div data-anim="panel-item" className="[grid-area:stats]">
              <SeatStats seat={seat} />
            </div>
            <div data-anim="panel-item" className="[grid-area:map] justify-self-end">
              <MiniMap
                active={seat}
                selected={selectedIds}
                occupied={occupied}
                onPick={props.onPick}
                className="h-[104px] w-auto lg:h-[124px]"
              />
            </div>
            <div data-anim="panel-item" className="flex min-w-0 flex-col gap-3 [grid-area:ctl]">
              <div className="flex items-center justify-between gap-3">
                <BookingSummary
                  seats={seats}
                  activeId={seat.id}
                  mode="focus"
                  onChip={props.onPick}
                  className="-my-1 min-w-0 py-1"
                />
                <div role="group" aria-label="Try a neighbouring seat" className="flex shrink-0 items-center gap-1">
                  {STEPS.map(({ direction, label, Icon }) => (
                    <button
                      key={direction}
                      type="button"
                      className="btn btn-glass h-9 w-9 disabled:opacity-30"
                      aria-label={label}
                      title={label}
                      disabled={!props.canStep[direction] || props.confirming}
                      onClick={() => props.onStep(direction)}
                    >
                      <Icon size={15} strokeWidth={2} aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
              <BookingActions
                stage="preview"
                total={props.total}
                loading={props.confirming}
                onBack={props.onBack}
                onConfirm={props.onConfirm}
              />
            </div>
          </div>
        </GlassPanel>
      </div>

      {booking && (
        <BookingConfirmation
          booking={booking}
          session={session}
          seats={booking.seatIds.map((id) => SEATS.find((s) => s.id === id)!).filter(Boolean)}
          onDone={props.onDone}
        />
      )}
    </div>
  )
}
