import { Clock, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { CINEMA, MOVIE } from '../data/cinema'

/** Editorial film block. `children` slots the session selector under the copy. */
export function MovieInformation({ children }: { children?: ReactNode }) {
  return (
    <section aria-labelledby="film-title" className="flex flex-col gap-5 lg:gap-7">
      <div className="flex items-end gap-4 lg:flex-col lg:items-stretch lg:gap-7">
        <div
          data-anim="poster"
          className="relative aspect-[4/5] w-[92px] shrink-0 overflow-hidden rounded-2xl shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.1)] lg:aspect-[16/10] lg:w-full lg:rounded-[28px]"
        >
          <img
            data-anim="poster-img"
            src={MOVIE.poster}
            alt={`Still from ${MOVIE.title}: a sailboat on a mirror-still sea beneath the Milky Way`}
            width={1200}
            height={763}
            decoding="async"
            fetchPriority="high"
            className="absolute inset-x-0 -top-[6%] h-[112%] w-full object-cover object-[28%_62%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-obsidian/70 via-transparent to-obsidian/10" />
          <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]" />
          <div className="absolute inset-x-4 bottom-3.5 hidden items-center justify-between lg:flex">
            <span className="eyebrow text-ink/80">Now showing</span>
            <span className="eyebrow text-ink/60">
              {CINEMA.hall} · {CINEMA.hallSpec}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p data-anim="info-item" className="eyebrow mb-2 text-accent lg:hidden">
            Now showing · {CINEMA.hall}
          </p>
          <h1
            id="film-title"
            data-anim="info-item"
            className="text-[clamp(2.1rem,9vw,2.9rem)] font-medium leading-[0.9] tracking-[-0.045em] lg:text-[clamp(3.4rem,4.6vw,5rem)]"
          >
            The <em className="font-serif text-[1.08em] font-normal tracking-[-0.02em] text-silver">Glass</em> Sea
          </h1>
          <ul
            data-anim="info-item"
            className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-mute lg:mt-5 lg:text-[13.5px]"
          >
            <li className="flex items-center gap-1.5">
              <Clock size={13} strokeWidth={1.75} aria-hidden />
              {MOVIE.duration}
            </li>
            <li aria-hidden className="h-0.5 w-0.5 rounded-full bg-mute" />
            <li>{MOVIE.genre}</li>
            <li aria-hidden className="h-0.5 w-0.5 rounded-full bg-mute" />
            <li className="rounded-[5px] px-1.5 py-px text-[11px] text-ink/80 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)]">
              {MOVIE.rating}
            </li>
            <li className="flex items-center gap-1 text-ink">
              <Star size={12} className="fill-accent text-accent" aria-hidden />
              <span className="num">{MOVIE.score}</span>
            </li>
          </ul>
        </div>
      </div>

      <p data-anim="info-item" className="hidden max-w-[38ch] text-[15px] leading-[1.55] text-mute lg:block">
        {MOVIE.synopsis} <span className="text-ink/50">Directed by {MOVIE.director}.</span>
      </p>

      {children}
    </section>
  )
}
