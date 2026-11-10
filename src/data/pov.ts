import type { CameraMetadata, PreviewKey, RowZone, Seat, SeatPreview, SideZone } from '../types'
import { HALL, SCREEN_CENTRE_Y } from './seats'

/**
 * POV mapping system.
 *
 * Every seat carries a `previewKey` (row zone × side zone). Each key resolves to a
 * `SeatPreview` with camera metadata describing how a person in that part of the
 * room actually looks at the screen. The final camera is solved from the seat's own
 * coordinates, so no two seats share an identical view. To add a camera position,
 * add a preview here (or override one seat in `SEAT_OVERRIDES`).
 */

const ROW_CAMERA: Record<RowZone, Omit<CameraMetadata, 'headTurn'>> = {
  front: { fov: 64, fovPortrait: 88, lookAtY: SCREEN_CENTRE_Y - 0.5 },
  middle: { fov: 50, fovPortrait: 76, lookAtY: SCREEN_CENTRE_Y - 1.15 },
  rear: { fov: 43, fovPortrait: 68, lookAtY: SCREEN_CENTRE_Y - 1.7 },
}

const ROW_COPY: Record<RowZone, { label: string; centre: string; side: string }> = {
  front: {
    label: 'Up close',
    centre: 'The screen fills your vision. Expect to look up and let your eyes roam.',
    side: 'Big and dramatic, with a pronounced angle across the screen.',
  },
  middle: {
    label: 'Sweet spot',
    centre: 'Eyes level with the heart of the frame. This is where the mix was mastered.',
    side: 'Comfortable distance with a gentle angle toward the centre.',
  },
  rear: {
    label: 'Full picture',
    centre: 'The whole frame at a glance, with the room falling away beneath you.',
    side: 'A wide, relaxed view from the edge of the house.',
  },
}

const HEAD_TURN: Record<SideZone, number> = { left: 0.3, centre: 0.55, right: 0.3 }

const rows: RowZone[] = ['front', 'middle', 'rear']
const sides: SideZone[] = ['left', 'centre', 'right']

export const SEAT_PREVIEWS: Record<PreviewKey, SeatPreview> = Object.fromEntries(
  rows.flatMap((rowPosition) =>
    sides.map((horizontalPosition) => {
      const id: PreviewKey = `${rowPosition}-${horizontalPosition}`
      const copy = ROW_COPY[rowPosition]
      const preview: SeatPreview = {
        id,
        rowPosition,
        horizontalPosition,
        label: copy.label,
        description: horizontalPosition === 'centre' ? copy.centre : copy.side,
        cameraMetadata: { ...ROW_CAMERA[rowPosition], headTurn: HEAD_TURN[horizontalPosition] },
      }
      return [id, preview] as const
    }),
  ),
) as Record<PreviewKey, SeatPreview>

/** Per-seat camera overrides, e.g. a seat behind a rail. */
const SEAT_OVERRIDES: Partial<Record<string, Partial<CameraMetadata>>> = {}

export interface CameraPose {
  position: [number, number, number]
  target: [number, number, number]
  /** World up for this pose. */
  up: [number, number, number]
  fov: number
  /** Vertical lens shift (fraction of viewport height). */
  shift?: number
}

const MAX_FOV = 104

export const previewFor = (seat: Seat): SeatPreview => SEAT_PREVIEWS[seat.previewKey]

/** Exact eye-level camera for a seat. */
export function seatPose(seat: Seat, aspect: number): CameraPose {
  const meta = { ...previewFor(seat).cameraMetadata, ...SEAT_OVERRIDES[seat.id] }
  // Blend FOV between portrait and landscape so resizing never pops.
  const t = Math.min(1, Math.max(0, (aspect - 0.6) / 0.9))
  const base = meta.fovPortrait + (meta.fov - meta.fovPortrait) * t
  const targetX = seat.xPosition * meta.headTurn
  // Never crop the picture: on narrow viewports, widen the lens until both
  // edges of the screen are in frame (up to an ultra-wide limit).
  const gaze = Math.atan2(targetX - seat.xPosition, seat.zPosition)
  const half = HALL.screenWidth / 2
  const spread = Math.max(
    Math.abs(Math.atan2(-half - seat.xPosition, seat.zPosition) - gaze),
    Math.abs(Math.atan2(half - seat.xPosition, seat.zPosition) - gaze),
  )
  const needed = (2 * Math.atan(Math.tan(Math.min(spread * 1.07, 1.45)) / aspect) * 180) / Math.PI
  return {
    position: [seat.xPosition, seat.yPosition, seat.zPosition],
    target: [targetX, meta.lookAtY, 0],
    up: [0, 1, 0],
    fov: Math.min(MAX_FOV, Math.max(base, needed)),
    // In portrait the seat panel covers the lower third, so lift the picture.
    shift: 0.17 * (1 - t),
  }
}

export interface PlanRegistration {
  /** Viewport size, px. */
  width: number
  height: number
  /** Where the seat sits on screen, px. */
  x: number
  y: number
  /** Scale of the 2D map: metres represented by one CSS pixel. */
  metresPerPx: number
}

const PLAN_FOV = 40

/** Plan view of the house, oriented like the seat map (screen at the top) and
 *  registered so this seat in 3D lands exactly on its 2D counterpart. */
export function overheadPose(seat: Seat, view: PlanRegistration): CameraPose {
  const height = (view.metresPerPx * view.height) / (2 * Math.tan((PLAN_FOV * Math.PI) / 360))
  const x = seat.xPosition - (view.x - view.width / 2) * view.metresPerPx
  const z = seat.zPosition - (view.y - view.height / 2) * view.metresPerPx
  // Measure the height from the chair, not the floor, so the raked rows do
  // not drift off their 2D positions through perspective.
  const chair = seat.yPosition - 0.5
  return { position: [x, chair + height, z], target: [x, 0, z], up: [0, 0, -1], fov: PLAN_FOV }
}

/** A wide establishing shot from the back of the house, high enough to see
 *  the booked seats glowing below. */
export function heroPose(aspect: number): CameraPose {
  return {
    position: [0, 7.1, HALL.depth - 1.2],
    target: [0, SCREEN_CENTRE_Y - 2.6, 0],
    up: [0, 1, 0],
    fov: aspect < 1 ? 78 : 46,
  }
}
