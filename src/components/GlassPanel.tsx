import type { ComponentPropsWithRef, PointerEvent } from 'react'

type GlassPanelProps = ComponentPropsWithRef<'div'> & {
  tone?: 'light' | 'dark'
  thin?: boolean
}

/** Translucent surface with a refraction rim and a specular highlight that
 *  follows the pointer. */
export function GlassPanel({ tone = 'light', thin, className = '', onPointerMove, ...rest }: GlassPanelProps) {
  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    onPointerMove?.(e)
  }
  return (
    <div
      className={`glass ${tone === 'dark' ? 'glass-dark' : ''} ${thin ? 'glass-thin' : ''} ${className}`}
      onPointerMove={handleMove}
      {...rest}
    />
  )
}
