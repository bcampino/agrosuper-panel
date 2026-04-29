import type { ReactNode } from 'react'

type Accent = 'yellow' | 'red' | 'blue' | 'navy'

const ACCENT_BG: Record<Accent, string> = {
  yellow: 'var(--shell-yellow)',
  red:    'var(--shell-red)',
  blue:   'var(--shell-blue)',
  navy:   'var(--shell-navy)',
}

/**
 * Header estándar del panel — patrón "eyebrow + title" alineado al moodboard Shell.
 *
 * Uso:
 *   <SectionHeader eyebrow="Resultados" title="Por Pilar" accent="yellow" />
 *   <SectionHeader eyebrow="Geografía" title="Por Región" accent="blue" right={<Filter />} />
 */
export function SectionHeader({
  eyebrow,
  title,
  accent = 'yellow',
  right,
  subtitle,
}: {
  eyebrow?: string
  title: string
  accent?: Accent
  right?: ReactNode
  subtitle?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-2">
            <div className="h-4 w-1 rounded-full" style={{ background: ACCENT_BG[accent] }} aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
          </div>
        )}
        <h2 className="text-lg font-black tracking-tight mt-1">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
