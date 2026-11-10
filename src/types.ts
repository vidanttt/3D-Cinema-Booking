export type SeatCategory = 'standard' | 'prime' | 'recliner'
export type RowZone = 'front' | 'middle' | 'rear'
export type SideZone = 'left' | 'centre' | 'right'
export type PreviewKey = `${RowZone}-${SideZone}`

/** A single physical seat. Positions are in metres, in hall space:
 *  x = distance from the centre line (negative = house left),
 *  y = eye height above the front floor, z = distance from the screen plane. */
export interface Seat {
  id: string
  row: string
  rowIndex: number
  number: number
  block: 0 | 1 | 2
  /** Column unit on the 2D map (aisles included). */
  col: number
  category: SeatCategory
  price: number
  xPosition: number
  yPosition: number
  zPosition: number
  /** -1 (far left) … 1 (far right). */
  xNorm: number
  /** Yaw of the chair, radians. Rows curve gently toward the screen. */
  facing: number
  distanceFromScreen: number
  /** Horizontal angle the screen fills from this seat, degrees. */
  viewingAngle: number
  offsetFromCentre: number
  /** 0–100 sightline score. */
  sightline: number
  previewKey: PreviewKey
}

export interface CameraMetadata {
  /** Vertical field of view for landscape viewports. */
  fov: number
  /** Vertical field of view for portrait viewports. */
  fovPortrait: number
  /** Height on the screen plane the viewer looks at, metres. */
  lookAtY: number
  /** 0 = head turned fully to screen centre, 1 = looking dead ahead. */
  headTurn: number
}

/** A representative viewing perspective. Seats map to one via `previewKey`;
 *  the exact camera is then solved per seat from its real position. */
export interface SeatPreview {
  id: PreviewKey
  rowPosition: RowZone
  horizontalPosition: SideZone
  label: string
  description: string
  cameraMetadata: CameraMetadata
}

export interface Session {
  id: string
  time: string
  format: string
  note: string
  /** Seed for deterministic occupancy. */
  seed: number
  fill: number
}

export interface Booking {
  reference: string
  sessionId: string
  seatIds: string[]
  total: number
}

export type Stage = 'select' | 'preview' | 'confirmed'
