import type { PreviewKey, RowZone, Seat, SeatCategory, Session, SideZone } from '../types'
import { CATEGORY } from './cinema'

/** Physical hall, metres. Shared by the 2D map and the 3D auditorium. */
export const HALL = {
  screenWidth: 14,
  screenHeight: 5.86, // 2.39:1
  screenBottom: 1.7,
  firstRowZ: 6,
  rowPitch: 1.15,
  riser: 0.3,
  eyeHeight: 1.14,
  seatPitch: 0.62,
  aisle: 1.25,
  rowCurve: 0.3,
  halfWidth: 8.2,
  depth: 19.5,
  height: 9.5,
} as const

export const SCREEN_CENTRE_Y = HALL.screenBottom + HALL.screenHeight / 2

export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'] as const
/** Seats per block (left, centre, right) for each row. */
const BLOCKS: [number, number, number][] = ROWS.map((_, i) => (i === 0 ? [2, 8, 2] : [3, 8, 3]))

/** Map columns: 3 + aisle + 8 + aisle + 3. */
export const MAP_COLS = 14
const BLOCK_START = [0, 3, 11]
const BLOCK_SIZE = [3, 8, 3]

const centreHalf = (BLOCK_SIZE[1] * HALL.seatPitch) / 2
const MAX_X = centreHalf + HALL.aisle + BLOCK_SIZE[2] * HALL.seatPitch - HALL.seatPitch / 2

function colToX(col: number): number {
  if (col < 3) return -(centreHalf + HALL.aisle + (2 - col) * HALL.seatPitch + HALL.seatPitch / 2)
  if (col > 10) return centreHalf + HALL.aisle + (col - 11) * HALL.seatPitch + HALL.seatPitch / 2
  return (col - 3 - 3.5) * HALL.seatPitch
}

const rowZone = (r: number): RowZone => (r <= 2 ? 'front' : r <= 6 ? 'middle' : 'rear')
const sideZone = (xn: number): SideZone => (xn < -0.42 ? 'left' : xn > 0.42 ? 'right' : 'centre')

function categoryFor(r: number, block: number): SeatCategory {
  if (r >= 8) return 'recliner'
  if (r >= 4 && r <= 6 && block === 1) return 'prime'
  return 'standard'
}

const deg = (rad: number) => (rad * 180) / Math.PI
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function buildSeats(): Seat[] {
  const seats: Seat[] = []
  ROWS.forEach((row, r) => {
    const sizes = BLOCKS[r]
    let number = 0
    for (let block = 0 as 0 | 1 | 2; block < 3; block = (block + 1) as 0 | 1 | 2) {
      const size = sizes[block]
      // Short blocks hug the aisle, so the missing seats are the outer ones.
      const skip = BLOCK_SIZE[block] - size
      for (let i = 0; i < size; i++) {
        number += 1
        const col = BLOCK_START[block] + i + (block === 0 ? skip : 0)
        const x = colToX(col)
        const xNorm = x / MAX_X
        const z = HALL.firstRowZ + r * HALL.rowPitch - HALL.rowCurve * xNorm * xNorm
        const y = r * HALL.riser + HALL.eyeHeight
        const half = HALL.screenWidth / 2
        const viewingAngle = deg(Math.atan2(half - x, z) + Math.atan2(half + x, z))
        const distance = Math.hypot(x, z)
        const vertical = deg(Math.atan2(SCREEN_CENTRE_Y - y, z))
        const sightline = clamp(
          Math.round(100 - Math.abs(viewingAngle - 60) * 0.75 - Math.abs(xNorm) * 15 - Math.max(0, vertical - 12) * 1.1),
          48,
          99,
        )
        const category = categoryFor(r, block)
        seats.push({
          id: `${row}${number}`,
          row,
          rowIndex: r,
          number,
          block,
          col,
          category,
          price: CATEGORY[category].price,
          xPosition: x,
          yPosition: y,
          zPosition: z,
          xNorm,
          facing: Math.atan2(x, z) * 0.6,
          distanceFromScreen: distance,
          viewingAngle,
          offsetFromCentre: x,
          sightline,
          previewKey: `${rowZone(r)}-${sideZone(xNorm)}` as PreviewKey,
        })
      }
    }
  })
  return seats
}

export const SEATS: Seat[] = buildSeats()
export const SEAT_BY_ID: ReadonlyMap<string, Seat> = new Map(SEATS.map((s) => [s.id, s]))
export const SEATS_BY_ROW: Seat[][] = ROWS.map((row) => SEATS.filter((s) => s.row === row))

export const getSeat = (id: string): Seat => {
  const seat = SEAT_BY_ID.get(id)
  if (!seat) throw new Error(`Unknown seat ${id}`)
  return seat
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const occupancyCache = new Map<string, ReadonlySet<string>>()

/** Deterministic sample occupancy: people book in pairs and favour the middle. */
export function occupiedFor(session: Session): ReadonlySet<string> {
  const cached = occupancyCache.get(session.id)
  if (cached) return cached
  const rand = mulberry32(session.seed)
  const taken = new Set<string>()
  SEATS_BY_ROW.forEach((row, r) => {
    const appeal = 1 - Math.abs(r - 5.5) / 9
    let i = 0
    while (i < row.length) {
      if (rand() < session.fill * (0.55 + appeal)) {
        const group = rand() < 0.6 ? 2 : rand() < 0.5 ? 1 : 3
        for (let g = 0; g < group && i + g < row.length; g++) {
          if (row[i + g].block === row[i].block) taken.add(row[i + g].id)
        }
        i += group + 1
      } else {
        i += 1
      }
    }
  })
  occupancyCache.set(session.id, taken)
  return taken
}

export const SIDE_LABEL: Record<SideZone, string> = { left: 'Left', centre: 'Centre', right: 'Right' }

export function offsetLabel(seat: Seat): string {
  const m = Math.abs(seat.offsetFromCentre)
  if (m < 0.35) return 'On the centre line'
  return `${m.toFixed(1)} m ${seat.offsetFromCentre < 0 ? 'left' : 'right'} of centre`
}

export type Direction = 'left' | 'right' | 'forward' | 'back'

/** Nearest free seat in a direction, for stepping through views. */
export function neighbour(seat: Seat, direction: Direction, blocked: ReadonlySet<string>): Seat | null {
  if (direction === 'left' || direction === 'right') {
    const row = SEATS_BY_ROW[seat.rowIndex]
    const step = direction === 'left' ? -1 : 1
    for (let i = row.indexOf(seat) + step; i >= 0 && i < row.length; i += step) {
      if (!blocked.has(row[i].id)) return row[i]
    }
    return null
  }
  const step = direction === 'forward' ? -1 : 1
  for (let r = seat.rowIndex + step; r >= 0 && r < SEATS_BY_ROW.length; r += step) {
    const free = SEATS_BY_ROW[r].filter((s) => !blocked.has(s.id))
    if (free.length) {
      return free.reduce((best, s) => (Math.abs(s.col - seat.col) < Math.abs(best.col - seat.col) ? s : best))
    }
  }
  return null
}
