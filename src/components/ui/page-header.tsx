import type { ReactNode } from 'react'

/**
 * Header estándar de página — eyebrow + título bold black + acciones a la derecha.
 * Uso consistente en todas las páginas del panel.
 *
 * Ej:
 *   <PageHeader eyebrow="Perfect Store" title="Resultados" right={<MonthFilter/>} />
 *   <PageHeader title="Auditorías" subtitle="1830 resultados" />
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        {subtitle && (
          <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
