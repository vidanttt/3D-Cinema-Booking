import { CATEGORY, money } from '../data/cinema'

const ITEMS = [
  { key: 'standard', label: CATEGORY.standard.label, price: CATEGORY.standard.price, state: 'available', category: 'standard' },
  { key: 'prime', label: CATEGORY.prime.label, price: CATEGORY.prime.price, state: 'available', category: 'prime' },
  { key: 'recliner', label: CATEGORY.recliner.label, price: CATEGORY.recliner.price, state: 'available', category: 'recliner' },
  { key: 'selected', label: 'Selected', price: null, state: 'selected', category: 'standard' },
  { key: 'occupied', label: 'Taken', price: null, state: 'occupied', category: 'standard' },
] as const

export function SeatLegend() {
  return (
    <ul
      data-anim="legend"
      aria-label="Seat legend"
      className="mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 text-[12px] text-mute sm:gap-x-7"
    >
      {ITEMS.map((item) => (
        <li key={item.key} className="flex items-center gap-2">
          <span
            aria-hidden
            className="seat pointer-events-none [--u:14px]"
            data-state={item.state}
            data-category={item.category}
          />
          <span>
            {item.label}
            {item.price !== null && <span className="num ml-1.5 text-ink/60">{money(item.price)}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
