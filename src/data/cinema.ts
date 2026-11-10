import type { SeatCategory, Session } from '../types'

export const MOVIE = {
  title: 'The Glass Sea',
  director: 'Ines Varga',
  year: 2026,
  duration: '2h 18m',
  genre: 'Sci‑Fi · Drama',
  rating: '12A',
  score: 8.7,
  synopsis:
    'A lone navigator crosses an ocean so still it mirrors the sky — and finds something looking back.',
  still: '/images/glass-sea-2400.jpg',
  poster: '/images/glass-sea-1200.jpg',
} as const

export const CINEMA = {
  brand: 'CINÉ',
  name: 'Aurelia',
  hall: 'Hall 01',
  hallSpec: 'Laser · Dolby Atmos',
  location: 'Southbank, London',
  date: 'Sat 14 Nov',
} as const

export const SESSIONS: Session[] = [
  { id: 's1620', time: '16:20', format: 'Laser', note: 'Matinee', seed: 11, fill: 0.2 },
  { id: 's1940', time: '19:40', format: 'Atmos', note: 'Prime time', seed: 29, fill: 0.36 },
  { id: 's2210', time: '22:10', format: '70mm', note: 'Late', seed: 47, fill: 0.27 },
]

export const DEFAULT_SESSION = SESSIONS[1].id

export const CATEGORY: Record<SeatCategory, { label: string; price: number; blurb: string }> = {
  standard: { label: 'Standard', price: 14, blurb: 'Classic velvet' },
  prime: { label: 'Prime', price: 18.5, blurb: 'Centre of the sound field' },
  recliner: { label: 'Recliner', price: 24, blurb: 'Full recline, extra legroom' },
}

export const MAX_SEATS = 6

export const money = (n: number) => `£${n.toFixed(2)}`
export const pad2 = (n: number) => String(n).padStart(2, '0')
