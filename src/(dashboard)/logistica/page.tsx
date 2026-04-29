import { ExternalLink, Truck } from 'lucide-react'

interface LogisticaRow {
  nombre: string
  detalle: string
  courier: string
  presupuesto: number
  link: string
}

const LOGISTICA: LogisticaRow[] = [
  {
    nombre: 'Envío POP Zona Norte — Enero 2026',
    detalle: 'Distribución de pendones, flejeras y stoppers a 42 locales',
    courier: 'Chilexpress',
    presupuesto: 1_250_000,
    link: 'https://docs.google.com/spreadsheets/d/example1',
  },
  {
    nombre: 'Despacho Muebles Payloader — Marzo 2026',
    detalle: '8 muebles exhibidores Shell Helix a locales nuevos',
    courier: 'Starken',
    presupuesto: 3_400_000,
    link: 'https://docs.google.com/spreadsheets/d/example2',
  },
  {
    nombre: 'Kit de Premios Ruleta Mystery — Q1 2026',
    detalle: 'Overoles, jockey y botellas para ganadores',
    courier: 'Blue Express',
    presupuesto: 890_000,
    link: 'https://docs.google.com/spreadsheets/d/example3',
  },
]

export default function LogisticaPage() {
  const totalPresupuesto = LOGISTICA.reduce((s, r) => s + r.presupuesto, 0)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Equipo Treid</p>
        <h1 className="text-2xl font-black tracking-tight">Logística</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Envíos, couriers y presupuestos</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border ring-1 ring-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 opacity-70">Envíos activos</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-blue-700">{LOGISTICA.length}</p>
        </div>
        <div className="rounded-2xl border ring-1 ring-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 opacity-70">Presupuesto total</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-emerald-700">
            ${totalPresupuesto.toLocaleString('es-CL')}
          </p>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/40 border-b flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Envíos · {LOGISTICA.length} registros
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="text-left px-4 py-2.5 font-semibold">Nombre</th>
                <th className="text-left px-4 py-2.5 font-semibold">Detalle</th>
                <th className="text-left px-4 py-2.5 font-semibold">Courier</th>
                <th className="text-right px-4 py-2.5 font-semibold">Presupuesto</th>
                <th className="text-center px-4 py-2.5 font-semibold">Excel</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {LOGISTICA.map((r, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{r.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs">{r.detalle}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {r.courier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    ${r.presupuesto.toLocaleString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <a
                      href={r.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
