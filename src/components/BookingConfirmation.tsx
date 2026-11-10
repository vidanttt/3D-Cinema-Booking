import { Check } from 'lucide-react'
import { CATEGORY, CINEMA, MOVIE, money, pad2 } from '../data/cinema'
import type { Booking, Seat, Session } from '../types'
import { GlassPanel } from './GlassPanel'

interface Props {
  booking: Booking
  session: Session
  seats: Seat[]
  onDone: () => void
}

/** Bar widths derived from the reference, so every ticket looks different. */
function bars(reference: string): number[] {
  const out: number[] = []
  for (let i = 0; i < 44; i++) {
    const code = reference.charCodeAt(i % reference.length)
    out.push(1 + ((code * (i + 3)) % 4))
  }
  return out
}

export function BookingConfirmation({ booking, session, seats, onDone }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-y-auto p-4 [perspective:1400px]">
      <GlassPanel
        data-anim="ticket"
        role="status"
        className="pointer-events-auto invisible w-full max-w-[400px] rounded-[34px] p-6 sm:p-7"
      >
        <div data-anim="ticket-item" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-[#0b1a05] shadow-[0_0_30px_rgb(164_242_122/0.55)]">
            <Check size={20} strokeWidth={2.6} aria-hidden />
          </span>
          <div>
            <p className="eyebrow text-accent">Booking confirmed</p>
            <p className="mt-0.5 text-[12.5px] text-mute">Tickets are on their way to your inbox.</p>
          </div>
        </div>

        <h2 data-anim="ticket-item" className="mt-6 text-[34px] font-medium leading-[0.95] tracking-[-0.04em]">
          See you <em className="font-serif text-[1.08em] font-normal text-silver">there.</em>
        </h2>

        <dl data-anim="ticket-item" className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-[13.5px]">
          <div className="col-span-2">
            <dt className="eyebrow !text-[9.5px] text-mute">Film</dt>
            <dd className="mt-1">{MOVIE.title}</dd>
          </div>
          <div>
            <dt className="eyebrow !text-[9.5px] text-mute">When</dt>
            <dd className="num mt-1">
              {CINEMA.date} · {session.time}
            </dd>
          </div>
          <div>
            <dt className="eyebrow !text-[9.5px] text-mute">Where</dt>
            <dd className="mt-1">
              {CINEMA.name} · {CINEMA.hall}
            </dd>
          </div>
        </dl>

        <ul data-anim="ticket-item" aria-label="Seats" className="mt-5 flex flex-wrap gap-1.5">
          {seats.map((seat) => (
            <li key={seat.id} className="chip" data-active="true">
              <span className="num">
                {seat.row}
                {pad2(seat.number)}
              </span>
              <span className="font-normal opacity-60">{CATEGORY[seat.category].label}</span>
            </li>
          ))}
        </ul>

        <div
          data-anim="ticket-item"
          className="mt-6 flex items-end justify-between border-t border-dashed border-white/20 pt-5"
        >
          <div>
            <p className="eyebrow !text-[9.5px] text-mute">Reference</p>
            <p className="mt-1 font-mono text-[17px] tracking-[0.08em]">{booking.reference}</p>
          </div>
          <div className="text-right">
            <p className="eyebrow !text-[9.5px] text-mute">Paid</p>
            <p className="num mt-1 text-[17px] font-medium tracking-[-0.02em]">{money(booking.total)}</p>
          </div>
        </div>

        <div data-anim="ticket-item" aria-hidden className="mt-4 flex h-9 items-stretch gap-[2px] opacity-70">
          {bars(booking.reference).map((w, i) => (
            <span key={i} className="bg-ink" style={{ flex: `${w} 0 0`, opacity: i % 2 ? 0 : 1 }} />
          ))}
        </div>

        <button
          data-anim="ticket-item"
          data-autofocus
          type="button"
          className="btn btn-light mt-6 h-12 w-full text-[14.5px]"
          onClick={onDone}
        >
          Done
        </button>
      </GlassPanel>
    </div>
  )
}
