import { ArrowLeft, ArrowRight, Eye } from 'lucide-react'
import { useRef } from 'react'
import { money } from '../data/cinema'
import { useMagnetic } from '../hooks/useMagnetic'

type Props =
  | { stage: 'select'; disabled: boolean; loading: boolean; onPreview: () => void }
  | { stage: 'preview'; total: number; loading: boolean; onBack: () => void; onConfirm: () => void }

export function BookingActions(props: Props) {
  const primaryRef = useRef<HTMLButtonElement>(null)
  useMagnetic(primaryRef, 0.18)

  if (props.stage === 'select') {
    return (
      <button
        ref={primaryRef}
        type="button"
        className="btn btn-accent h-12 w-full px-6 text-[14.5px] sm:w-auto"
        disabled={props.disabled || props.loading}
        aria-busy={props.loading}
        onClick={props.onPreview}
      >
        {props.loading ? <span className="spinner" aria-hidden /> : <Eye size={16} strokeWidth={2.2} aria-hidden />}
        See your view
        <ArrowRight size={16} strokeWidth={2.2} className="arrow" aria-hidden />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn btn-glass h-12 shrink-0 px-4 text-[13.5px]"
        onClick={props.onBack}
        disabled={props.loading}
      >
        <ArrowLeft size={15} strokeWidth={2} aria-hidden />
        Map
      </button>
      <button
        ref={primaryRef}
        type="button"
        data-autofocus
        className="btn btn-accent h-12 flex-1 px-6 text-[14.5px]"
        disabled={props.loading}
        aria-busy={props.loading}
        onClick={props.onConfirm}
      >
        {props.loading ? (
          <>
            <span className="spinner" aria-hidden />
            Booking…
          </>
        ) : (
          <>
            Confirm
            <span className="num opacity-70">{money(props.total)}</span>
            <ArrowRight size={16} strokeWidth={2.2} className="arrow" aria-hidden />
          </>
        )}
      </button>
    </div>
  )
}
