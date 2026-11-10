import { DEFAULT_SESSION, MAX_SEATS } from './data/cinema'
import type { Booking, Stage } from './types'

export interface BookingState {
  stage: Stage
  sessionId: string
  /** Selected seat ids, in the order they were picked. */
  selected: string[]
  /** The seat whose view is being previewed. */
  activeId: string | null
  /** Seats booked in this visit, per session. */
  booked: Record<string, string[]>
  booking: Booking | null
}

export type BookingAction =
  | { type: 'toggle'; id: string }
  | { type: 'focus'; id: string }
  | { type: 'swap'; to: string }
  | { type: 'session'; id: string }
  | { type: 'stage'; stage: Stage }
  | { type: 'confirm'; booking: Booking }
  | { type: 'finish' }

export const initialState: BookingState = {
  stage: 'select',
  sessionId: DEFAULT_SESSION,
  selected: [],
  activeId: null,
  booked: {},
  booking: null,
}

export function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'toggle': {
      if (state.selected.includes(action.id)) {
        const selected = state.selected.filter((id) => id !== action.id)
        const activeId = state.activeId === action.id ? (selected[selected.length - 1] ?? null) : state.activeId
        return { ...state, selected, activeId }
      }
      if (state.selected.length >= MAX_SEATS) return state
      return { ...state, selected: [...state.selected, action.id], activeId: action.id }
    }
    case 'focus':
      return state.selected.includes(action.id) ? { ...state, activeId: action.id } : state
    case 'swap': {
      // Move the active seat somewhere else, keeping its place in the order.
      if (!state.activeId || state.selected.includes(action.to)) return state
      return {
        ...state,
        selected: state.selected.map((id) => (id === state.activeId ? action.to : id)),
        activeId: action.to,
      }
    }
    case 'session':
      return action.id === state.sessionId ? state : { ...state, sessionId: action.id, selected: [], activeId: null }
    case 'stage':
      return { ...state, stage: action.stage }
    case 'confirm':
      return { ...state, stage: 'confirmed', booking: action.booking }
    case 'finish': {
      const booking = state.booking
      if (!booking) return { ...state, stage: 'select' }
      return {
        ...state,
        stage: 'select',
        selected: [],
        activeId: null,
        booking: null,
        booked: {
          ...state.booked,
          [booking.sessionId]: [...(state.booked[booking.sessionId] ?? []), ...booking.seatIds],
        },
      }
    }
  }
}
