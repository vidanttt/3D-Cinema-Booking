import { MOVIE } from '../data/cinema'

/** The screen as seen from above the house: a curved band of picture with light
 *  spilling toward the seats. */
export function CinemaScreen() {
  return (
    <div data-anim="screen" className="pointer-events-none relative mx-auto w-full" aria-hidden>
      <svg viewBox="0 0 1000 150" className="relative z-10 block w-full overflow-visible">
        <defs>
          <clipPath id="screen-band">
            <path d="M30 100 Q500 4 970 100 L962 136 Q500 44 38 136 Z" />
          </clipPath>
          <linearGradient id="screen-edge" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.14" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="0.5" stopColor="#fff" />
            <stop offset="0.86" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="screen-fade" x1="0" x2="1">
            <stop offset="0" stopColor="#080809" stopOpacity="0.85" />
            <stop offset="0.22" stopColor="#080809" stopOpacity="0" />
            <stop offset="0.78" stopColor="#080809" stopOpacity="0" />
            <stop offset="1" stopColor="#080809" stopOpacity="0.85" />
          </linearGradient>
          <filter id="screen-glow" x="-10%" y="-300%" width="120%" height="700%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <g clipPath="url(#screen-band)">
          <image href={MOVIE.poster} x="0" y="-250" width="1000" height="636" preserveAspectRatio="xMidYMid slice" />
          <rect width="1000" height="150" fill="url(#screen-fade)" />
        </g>
        <path
          d="M30 100 Q500 4 970 100"
          fill="none"
          stroke="#bcd3ff"
          strokeWidth="5"
          filter="url(#screen-glow)"
          opacity="0.8"
        />
        <path d="M30 100 Q500 4 970 100" fill="none" stroke="url(#screen-edge)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {/* Light falling into the room */}
      <div className="absolute inset-x-[4%] top-[58%] h-[clamp(120px,22vw,300px)] bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,rgb(120_160_255/0.2),rgb(255_190_120/0.05)_45%,transparent_72%)]" />
      <p className="eyebrow absolute inset-x-0 top-[92%] z-10 text-center !text-[9.5px] !tracking-[0.6em] text-mute/80">
        Screen
      </p>
    </div>
  )
}
