import { MapPin } from 'lucide-react'
import { CINEMA, MOVIE } from '../data/cinema'
import type { Session } from '../types'
import { GlassPanel } from './GlassPanel'

const NAV = ['Films', 'Cinemas', 'Membership']

export function CinemaHeader({ session }: { session: Session }) {
  return (
    <header data-anim="header" className="relative z-20 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
      <GlassPanel
        thin
        tone="dark"
        className="mx-auto flex h-14 max-w-[1400px] items-center justify-between rounded-full pl-6 pr-2"
      >
        <a href="#top" className="flex items-baseline gap-2" aria-label={`${CINEMA.brand} ${CINEMA.name}`}>
          <span className="text-[17px] font-semibold tracking-[0.28em]">
            CIN<span className="text-accent">É</span>
          </span>
          <span className="hidden font-serif text-[17px] italic text-mute sm:inline">{CINEMA.name}</span>
        </a>

        <nav aria-label="Primary" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
          {NAV.map((item, i) => (
            <a
              key={item}
              href="#top"
              aria-current={i === 0 ? 'page' : undefined}
              className={`text-[13px] tracking-[-0.01em] transition-colors duration-300 hover:text-ink ${i === 0 ? 'text-ink' : 'text-mute'}`}
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="hidden items-center gap-1.5 pr-2 text-mute md:flex">
            <MapPin size={13} strokeWidth={1.75} aria-hidden />
            {CINEMA.location}
          </span>
          <span className="flex h-10 items-center gap-2.5 rounded-full bg-white/[0.07] px-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)]">
            <span className="hidden max-w-[14ch] truncate text-mute sm:inline">{MOVIE.title}</span>
            <span className="hidden h-3 w-px bg-white/15 sm:inline" />
            <span className="num">
              {CINEMA.date} · {session.time}
            </span>
          </span>
        </div>
      </GlassPanel>
    </header>
  )
}
