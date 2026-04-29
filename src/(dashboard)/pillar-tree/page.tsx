import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PillarTreeRootDiagram } from '@/components/pillar-tree/pillar-tree-root-diagram'
import PillarTreeEditor from '@/components/pillar-tree/pillar-tree-editor'

// ── Ejemplo de cálculo ────────────────────────────────────────────────────────
//
// Lógica (alineada con Power BI corporativo Shell/ENEX):
//
//  INDIVIDUAL (por auditoría):
//    - Todas las preguntas del pilar cuentan SIEMPRE (aunque no haya respuesta = 0 pts).
//    - NO se normaliza: denominador del pilar es 100 (suma de pesos máximos).
//    - EXH-08 Todos en buen estado: computed desde cartel, mueble, pendón Helix, pendón Rímula.
//      Todos Si → 100 · alguno No → 33 · todos No → 0.
//    - Recomendación usa cascade: mejor posición Shell = 25 / 15 / 10 / 0 pts.
//    - Precio reparte 80% comparación (4 pts × 3) + 20% precio visible (1 pt × 3).
//
//  AGREGADO (promedios por mes):
//    - Solo cuentan auditorías con `info_levantada = true` (levantamiento exitoso).
//    - Cada pilar se promedia sobre los locales que midieron ese pilar específico
//      (si 11 locales no respondieron ningún precio → no entran al promedio de Precio).

function PillarRow({ label, score, pct, weight, contribution }: {
  label: string; score: string; pct: number; weight: number; contribution: number
}) {
  const barColor =
    pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 gap-y-0.5 items-center text-sm py-1.5 border-b last:border-0">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground text-right tabular-nums w-28">{score}</span>
      <div className="flex items-center gap-1.5 w-28">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{pct}%</span>
      </div>
      <span className="text-muted-foreground tabular-nums text-right w-12">×{weight}%</span>
      <span className="font-semibold tabular-nums text-right w-12">{contribution.toFixed(1)} pts</span>
    </div>
  )
}

function ScoringExample() {
  // ── Ejemplo 1: Local "Shell La Florida" — Marzo 2026 (info_levantada = SI)
  //    Local sin mueble, responde solo 1 de 3 precios.

  // Exhibición (30 pts máx)
  const exhQuestions = [
    { id: 'EXH-01', label: 'Bastidor Shell',        answer: 'Sí (bastidor Shell)', pts: 100, w: 23.33 },
    { id: 'EXH-02', label: 'Letrero externo Shell', answer: 'No',                   pts: 0,   w: 6.67 },
    { id: 'EXH-03', label: 'Mueble Shell',          answer: 'No',                   pts: 0,   w: 20.00 },
    { id: 'EXH-05', label: 'Pendón Shell Helix',    answer: 'Sí',                   pts: 100, w: 13.33 },
    { id: 'EXH-06', label: 'Pendón Shell Rímula',   answer: 'No',                   pts: 0,   w: 13.34 },
    { id: 'EXH-07', label: 'Pack Ideal completo',   answer: 'No',                   pts: 0,   w: 20.00 },
    { id: 'EXH-08', label: 'Todos en buen estado',  answer: 'alguno No → 33', pts: 33, w: 3.33, note: true },
  ]
  const exhRaw = exhQuestions.reduce((s, q) => s + q.pts * q.w / 100, 0)
  const exhPct = Math.round(exhRaw * 10) / 10

  // Disponibilidad (30 pts máx): cada pregunta 33.33% de peso
  const dispQuestions = [
    { id: 'DISP-01', label: 'Helix HX7 SP 10W40',        answer: 'Visible en góndola', val: 100, w: 33.33 },
    { id: 'DISP-02', label: 'Helix HX8 Pro AG 5W30',     answer: 'Visible en góndola', val: 100, w: 33.33 },
    { id: 'DISP-03', label: 'Helix Ultra Pro AG 5W30',   answer: 'No vende',           val: 0,   w: 33.34 },
  ]
  const dispRaw = dispQuestions.reduce((s, q) => s + q.val * q.w / 100, 0)
  const dispPct = Math.round(dispRaw * 10) / 10

  // Precio (15 pts): 80% comparación (26.67% c/u × 3) + 20% visible (6.67% × 3)
  const prcQuestions = [
    { id: 'PRC-01', label: 'HX7 vs Super 2000',        answer: 'Igual o menor', val: 100, w: 26.67, missing: false },
    { id: 'PRC-02', label: 'HX8 vs Super 3000',        answer: 'No respondido', val: 0,   w: 26.67, missing: true },
    { id: 'PRC-03', label: 'Ultra vs Mobil 1 ESP',     answer: 'No respondido', val: 0,   w: 26.67, missing: true },
    { id: 'PRC-04', label: 'Precio HX7 visible',       answer: 'Sí',            val: 100, w: 6.67,  missing: false },
    { id: 'PRC-05', label: 'Precio HX8 visible',       answer: 'No respondido', val: 0,   w: 6.67,  missing: true },
    { id: 'PRC-06', label: 'Precio Ultra visible',     answer: 'No respondido', val: 0,   w: 6.66,  missing: true },
  ]
  const prcRaw = prcQuestions.reduce((s, q) => s + q.val * q.w / 100, 0)
  const prcPct = Math.round(prcRaw * 10) / 10

  // Recomendación (25 pts máx): cascade
  const recResp = { rec1: 'Shell', rec2: 'Mobil', rec3: 'Castrol' }
  const recPts =
    recResp.rec1 === 'Shell' ? 25 :
    recResp.rec2 === 'Shell' ? 15 :
    recResp.rec3 === 'Shell' ? 10 : 0
  const recPct = (recPts / 25) * 100

  // Totales absolutos (puntos)
  const dispPoints   = Math.round(dispPct * 30 / 100 * 10) / 10
  const exhPoints    = Math.round(exhPct  * 30 / 100 * 10) / 10
  const prcPoints    = Math.round(prcPct  * 15 / 100 * 10) / 10
  const recPoints    = recPts
  const totalPoints  = Math.round((dispPoints + exhPoints + prcPoints + recPoints) * 10) / 10

  // ── Ejemplo 2: Local "Shell La Florida" — Historial últimos 4 meses
  //    (Feb se excluye porque info_levantada = false)
  const localHistory = [
    { month: 'Dic 2025', info: true,  disp: 22, exh: 14, prc: 8, rec: 25, total: 69 },
    { month: 'Ene 2026', info: true,  disp: 20, exh: 11, prc: 5, rec: 25, total: 61 },
    { month: 'Feb 2026', info: false, disp: 0,  exh: 0,  prc: 0, rec: 0,  total: 0 },
    { month: 'Mar 2026', info: true,  disp: dispPoints, exh: exhPoints, prc: prcPoints, rec: recPoints, total: totalPoints },
  ]
  const historyValid = localHistory.filter(m => m.info)
  const avgLocal = {
    disp:  historyValid.reduce((s, m) => s + m.disp, 0)  / historyValid.length,
    exh:   historyValid.reduce((s, m) => s + m.exh,  0)  / historyValid.length,
    prc:   historyValid.reduce((s, m) => s + m.prc,  0)  / historyValid.length,
    rec:   historyValid.reduce((s, m) => s + m.rec,  0)  / historyValid.length,
    total: historyValid.reduce((s, m) => s + m.total, 0) / historyValid.length,
  }

  // ── Ejemplo 3: Un mes (Marzo 2026) agregado sobre varias tiendas
  //    215 tiendas con info_levantada = true, 16 con false (excluidas)
  const monthAgg = {
    totalAudits: 231,
    infoSi: 215,
    infoNo: 16,
    locationsActive: 248,
    pillarDenominators: {
      disp: 215,
      exh: 215,
      prc: 204, // 11 no respondieron ningún precio → excluidos del promedio de Precio
      rec: 215,
    },
    sums: {
      disp: 4828,
      exh:  2139,
      prc:  975,
      rec:  2866,
    },
  }
  const monthAvg = {
    disp:  Math.round((monthAgg.sums.disp / monthAgg.pillarDenominators.disp) * 100) / 100,
    exh:   Math.round((monthAgg.sums.exh  / monthAgg.pillarDenominators.exh ) * 100) / 100,
    prc:   Math.round((monthAgg.sums.prc  / monthAgg.pillarDenominators.prc ) * 100) / 100,
    rec:   Math.round((monthAgg.sums.rec  / monthAgg.pillarDenominators.rec ) * 100) / 100,
  }
  const monthAvgTotal = Math.round((monthAvg.disp + monthAvg.exh + monthAvg.prc + monthAvg.rec) * 10) / 10

  return (
    <div className="max-w-5xl mx-auto space-y-4 pt-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Cómo se calcula la nota</p>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Filtro inicial: ¿Se logró levantamiento? */}
      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
            1
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold text-foreground">
              Paso previo: solo se calculan las auditorías con levantamiento exitoso
            </p>
            <p className="text-sm text-muted-foreground">
              La primera pregunta del formulario es <strong className="text-foreground">&ldquo;¿Se logró realizar el levantamiento de información?&rdquo;</strong>. Si la respuesta es:
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-xs font-bold">✓</span>
                  <span className="text-sm font-semibold text-emerald-700">Sí levantó</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  La auditoría <strong>entra al cálculo</strong>. Se aplican todos los pilares y se calcula la nota.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">✕</span>
                  <span className="text-sm font-semibold text-red-600">No levantó</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  La auditoría queda <strong>registrada pero excluida</strong> del cálculo de notas y de los promedios del dashboard.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic pt-1">
              Razones de &ldquo;No&rdquo;: local cerrado, locatario rechaza info, no hay nadie para atender, etc. Estas visitas no penalizan al local — simplemente no cuentan ese mes.
            </p>
          </div>
        </div>
      </div>

      {/* Reglas del cálculo */}
      <div className="rounded-xl border bg-amber-50/60 dark:bg-amber-900/10 border-amber-200 p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-lg">
            2
          </div>
          <div className="flex-1 space-y-2 text-xs">
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-300">Reglas del cálculo</p>
            <ul className="space-y-1 text-amber-950 dark:text-amber-200 list-disc pl-4">
              <li><strong>Individual:</strong> todas las preguntas cuentan. Sin respuesta = 0 pts. Denominador fijo en 100.</li>
              <li><strong>EXH-08 (todos en buen estado):</strong> computed desde cartel (EXH-01), mueble (EXH-03), pendón Helix (EXH-05), pendón Rímula (EXH-06). Todos Si → 100 · alguno No → 33 · todos No → 0.</li>
              <li><strong>Recomendación:</strong> cascade — mejor posición Shell = 25 / 15 / 10 / 0 pts.</li>
              <li><strong>Precio:</strong> 80% comparación (4 pts × 3 = 12 pts) + 20% visible (1 pt × 3 = 3 pts).</li>
              <li><strong>Agregado (promedios):</strong> solo auditorías con levantamiento = Sí. Cada pilar se promedia sobre locales que midieron ese pilar específico.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-border" />
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ejemplos de cálculo</p>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* ─────────── Ejemplo 1: Individual por visita ─────────── */}
      <details className="rounded-xl border bg-card overflow-hidden group">
        <summary className="px-4 py-2.5 bg-muted/40 border-b cursor-pointer flex items-center justify-between list-none hover:bg-muted/60 transition-colors">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ejemplo 1 · Cálculo individual por visita</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Local <strong>Shell La Florida</strong> — Marzo 2026 · info_levantada = <span className="text-emerald-700 font-medium">Sí</span>
            </p>
          </div>
          <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </summary>

        <div className="p-4 space-y-5">

          {/* Disponibilidad */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">Disponibilidad — 30 pts máx</p>
            <div className="text-xs text-muted-foreground mb-2">
              Cada SKU vale 10 pts. Visible = 10 · Bodega/quiebre = 2 · No vende = 0.
            </div>
            <div className="rounded-lg border overflow-hidden text-xs">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 bg-muted/30 text-muted-foreground font-medium border-b">
                <span>ID</span><span>Pregunta</span><span className="w-40">Respuesta</span><span className="w-12 text-right">valor</span><span className="w-12 text-right">peso%</span>
              </div>
              {dispQuestions.map(q => (
                <div key={q.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 border-b last:border-0 items-center">
                  <span className="text-muted-foreground font-mono">{q.id}</span>
                  <span>{q.label}</span>
                  <span className={`w-40 ${q.val === 0 ? 'text-muted-foreground' : 'text-emerald-700 font-medium'}`}>{q.answer}</span>
                  <span className="w-12 text-right tabular-nums">{q.val}</span>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">{q.w.toFixed(2)}%</span>
                </div>
              ))}
              <div className="px-3 py-2 bg-muted/20 text-xs font-semibold flex justify-between">
                <span>Nota = Σ(valor × peso / 100) = {dispRaw.toFixed(2)}%</span>
                <span className="tabular-nums">{dispPct}% → {dispPoints} / 30 pts</span>
              </div>
            </div>
          </div>

          {/* Exhibición */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 mb-2">Exhibición y POP — 30 pts máx</p>
            <div className="text-xs text-muted-foreground mb-2">
              7 preguntas con pesos específicos. Si = 100 · No = 0. EXH-08 computed: todos en buen estado → 100, alguno No → 33, todos No → 0.
            </div>
            <div className="rounded-lg border overflow-hidden text-xs">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 bg-muted/30 text-muted-foreground font-medium border-b">
                <span>ID</span><span>Pregunta</span><span className="w-44">Respuesta</span><span className="w-12 text-right">valor</span><span className="w-12 text-right">peso%</span>
              </div>
              {exhQuestions.map(q => (
                <div key={q.id} className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 border-b last:border-0 items-center ${q.note ? 'bg-amber-50/40' : ''}`}>
                  <span className="text-muted-foreground font-mono">{q.id}</span>
                  <span>{q.label}</span>
                  <span className={`w-44 ${q.pts === 0 ? (q.note ? 'text-amber-700 italic' : 'text-muted-foreground') : 'text-emerald-700 font-medium'}`}>{q.answer}</span>
                  <span className="w-12 text-right tabular-nums">{q.pts}</span>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">{q.w.toFixed(2)}%</span>
                </div>
              ))}
              <div className="px-3 py-2 bg-muted/20 text-xs font-semibold flex justify-between">
                <span>Nota = Σ(valor × peso / 100) = {exhRaw.toFixed(2)}%</span>
                <span className="tabular-nums">{exhPct}% → {exhPoints} / 30 pts</span>
              </div>
            </div>
          </div>

          {/* Precio */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 mb-2">Precio — 15 pts máx · 80/20</p>
            <div className="text-xs text-muted-foreground mb-2">
              3 comparaciones (26.67% c/u = 4 pts) + 3 visibles (6.67% c/u = 1 pt). <span className="text-red-600 font-medium">No respondido = 0 pts</span>.
            </div>
            <div className="rounded-lg border overflow-hidden text-xs">
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 bg-muted/30 text-muted-foreground font-medium border-b">
                <span>ID</span><span>Componente</span><span className="w-32">Resultado</span><span className="w-12 text-right">valor</span><span className="w-12 text-right">peso%</span>
              </div>
              {prcQuestions.map(q => (
                <div key={q.id} className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 border-b last:border-0 items-center ${q.missing ? 'bg-red-50/40' : ''}`}>
                  <span className="text-muted-foreground font-mono">{q.id}</span>
                  <span>{q.label}</span>
                  <span className={`w-32 ${q.missing ? 'text-red-600 italic' : q.val === 0 ? 'text-muted-foreground' : 'text-emerald-700 font-medium'}`}>{q.answer}</span>
                  <span className="w-12 text-right tabular-nums">{q.val}</span>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">{q.w.toFixed(2)}%</span>
                </div>
              ))}
              <div className="px-3 py-2 bg-muted/20 text-xs font-semibold flex justify-between">
                <span>Nota = Σ(valor × peso / 100) = {prcRaw.toFixed(2)}%</span>
                <span className="tabular-nums">{prcPct}% → {prcPoints} / 15 pts</span>
              </div>
            </div>
          </div>

          {/* Recomendación */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-2">Recomendación — 25 pts máx · cascade</p>
            <div className="text-xs text-muted-foreground mb-2">
              Mejor posición de Shell = <strong>1ª (25 pts)</strong> · 2ª (15 pts) · 3ª (10 pts) · no aparece (0 pts). Viene del formulario de Mystery (652647).
            </div>
            <div className="rounded-lg border overflow-hidden text-xs">
              <div className="grid grid-cols-3 px-3 py-1.5 bg-muted/30 text-muted-foreground font-medium border-b">
                <span>Posición</span><span>Respuesta</span><span className="text-right">pts</span>
              </div>
              {[
                { pos: '1ª recomendación', val: recResp.rec1, pts: 25, active: recResp.rec1 === 'Shell' },
                { pos: '2ª recomendación', val: recResp.rec2, pts: 15, active: recResp.rec1 !== 'Shell' && recResp.rec2 === 'Shell' },
                { pos: '3ª recomendación', val: recResp.rec3, pts: 10, active: recResp.rec1 !== 'Shell' && recResp.rec2 !== 'Shell' && recResp.rec3 === 'Shell' },
              ].map((r, i) => (
                <div key={i} className="grid grid-cols-3 px-3 py-1.5 border-b last:border-0 items-center">
                  <span className="text-muted-foreground">{r.pos}</span>
                  <span className={r.active ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}>{r.val}</span>
                  <span className="text-right tabular-nums">{r.active ? r.pts : '—'}</span>
                </div>
              ))}
              <div className="px-3 py-2 bg-muted/20 text-xs font-semibold flex justify-between">
                <span>Cascade: Shell en 1ª = 25 pts</span>
                <span className="tabular-nums">{recPct.toFixed(0)}% → {recPoints} / 25 pts</span>
              </div>
            </div>
          </div>

          {/* Totalizador */}
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">Nota final de la visita</p>
            <PillarRow label="Disponibilidad" score={`${dispPoints}/30 (${dispPct}%)`} pct={dispPct} weight={30} contribution={dispPoints} />
            <PillarRow label="Exhibición y POP" score={`${exhPoints}/30 (${exhPct}%)`} pct={exhPct} weight={30} contribution={exhPoints} />
            <PillarRow label="Precio" score={`${prcPoints}/15 (${prcPct}%)`} pct={prcPct} weight={15} contribution={prcPoints} />
            <PillarRow label="Recomendación" score={`${recPoints}/25 (${recPct.toFixed(0)}%)`} pct={recPct} weight={25} contribution={recPoints} />
            <div className="mt-3 pt-3 border-t flex items-center justify-between">
              <span className="font-bold text-sm">Nota total</span>
              <div className="flex items-center gap-3">
                <div className="h-2 w-32 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${totalPoints}%` }} />
                </div>
                <span className="text-2xl font-bold tabular-nums">{totalPoints} / 100</span>
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* ─────────── Ejemplo 2: Acumulado del local en el tiempo ─────────── */}
      <details className="rounded-xl border bg-card overflow-hidden group">
        <summary className="px-4 py-2.5 bg-muted/40 border-b cursor-pointer flex items-center justify-between list-none hover:bg-muted/60 transition-colors">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ejemplo 2 · Acumulado del local (varios meses)</p>
          <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-3">
            El promedio del local se calcula solo sobre las <strong>auditorías con info_levantada = Sí</strong>. Los meses sin levantamiento se excluyen.
          </p>
          <div className="rounded-lg border overflow-hidden text-xs">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-x-3 px-3 py-1.5 bg-muted/30 text-muted-foreground font-medium border-b">
              <span>Mes</span>
              <span className="w-20 text-right">info lev.</span>
              <span className="w-14 text-right">Disp.</span>
              <span className="w-14 text-right">Exh.</span>
              <span className="w-14 text-right">Prec.</span>
              <span className="w-14 text-right">Rec.</span>
              <span className="w-14 text-right font-semibold text-foreground">Total</span>
            </div>
            {localHistory.map(m => {
              const excluded = !m.info
              return (
                <div key={m.month} className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-x-3 px-3 py-1.5 border-b last:border-0 items-center ${excluded ? 'bg-muted/20 text-muted-foreground italic' : ''}`}>
                  <span>{m.month}</span>
                  <span className={`w-20 text-right ${excluded ? 'text-red-600' : 'text-emerald-700'}`}>{m.info ? 'Sí' : 'No — excluido'}</span>
                  <span className="w-14 text-right tabular-nums">{excluded ? '—' : m.disp}</span>
                  <span className="w-14 text-right tabular-nums">{excluded ? '—' : m.exh}</span>
                  <span className="w-14 text-right tabular-nums">{excluded ? '—' : m.prc}</span>
                  <span className="w-14 text-right tabular-nums">{excluded ? '—' : m.rec}</span>
                  <span className={`w-14 text-right tabular-nums font-bold ${excluded ? '' : m.total >= 70 ? 'text-emerald-700' : m.total >= 50 ? 'text-yellow-700' : 'text-red-600'}`}>{excluded ? '—' : m.total}</span>
                </div>
              )
            })}
            <div className="px-3 py-2 bg-muted/20 grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-x-3">
              <span className="text-xs font-semibold">Promedio del local ({historyValid.length} meses válidos)</span>
              <span className="w-20" />
              <span className="w-14 text-right tabular-nums text-sm font-semibold">{avgLocal.disp.toFixed(1)}</span>
              <span className="w-14 text-right tabular-nums text-sm font-semibold">{avgLocal.exh.toFixed(1)}</span>
              <span className="w-14 text-right tabular-nums text-sm font-semibold">{avgLocal.prc.toFixed(1)}</span>
              <span className="w-14 text-right tabular-nums text-sm font-semibold">{avgLocal.rec.toFixed(1)}</span>
              <span className="w-14 text-right tabular-nums text-sm font-bold text-emerald-700">{avgLocal.total.toFixed(1)}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            En este ejemplo, Feb 2026 no se levantó info (local cerrado o rechazó) → la auditoría queda registrada pero <strong>no entra al promedio</strong>.
          </p>
        </div>
      </details>

      {/* ─────────── Ejemplo 3: Un mes con varias tiendas ─────────── */}
      <details className="rounded-xl border bg-card overflow-hidden group">
        <summary className="px-4 py-2.5 bg-muted/40 border-b cursor-pointer flex items-center justify-between list-none hover:bg-muted/60 transition-colors">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ejemplo 3 · Un mes con varias tiendas (agregado)</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Marzo 2026 — <strong>{monthAgg.totalAudits}</strong> auditorías totales, <strong>{monthAgg.infoSi}</strong> con info_levantada = Sí (denominador del dashboard).
            </p>
          </div>
          <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="p-4 space-y-3">

          {/* KPIs de cobertura */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Tiendas visitadas</p>
              <p className="text-xl font-bold">{monthAgg.infoSi}</p>
              <p className="text-xs text-muted-foreground">de {monthAgg.locationsActive} activas</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Visitadas sin info</p>
              <p className="text-xl font-bold text-red-600">{monthAgg.infoNo}</p>
              <p className="text-xs text-muted-foreground">excluidas del cálculo</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Total auditorías</p>
              <p className="text-xl font-bold">{monthAgg.totalAudits}</p>
              <p className="text-xs text-muted-foreground">suma Sí + No</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Nota promedio total</p>
              <p className="text-xl font-bold text-primary">{monthAvgTotal} / 100</p>
              <p className="text-xs text-muted-foreground">sobre {monthAgg.infoSi} tiendas</p>
            </div>
          </div>

          {/* Promedio por pilar */}
          <div className="rounded-lg border overflow-hidden text-xs">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-1.5 bg-muted/30 text-muted-foreground font-medium border-b">
              <span>Pilar</span>
              <span className="w-24 text-right">Σ pts de tiendas</span>
              <span className="w-24 text-right">Tiendas que midieron</span>
              <span className="w-20 text-right">Promedio</span>
              <span className="w-16 text-right">Máx pilar</span>
            </div>
            {[
              { label: 'Disponibilidad', sum: monthAgg.sums.disp, denom: monthAgg.pillarDenominators.disp, avg: monthAvg.disp, max: 30 },
              { label: 'Exhibición y POP', sum: monthAgg.sums.exh, denom: monthAgg.pillarDenominators.exh, avg: monthAvg.exh, max: 30 },
              { label: 'Precio', sum: monthAgg.sums.prc, denom: monthAgg.pillarDenominators.prc, avg: monthAvg.prc, max: 15 },
              { label: 'Recomendación', sum: monthAgg.sums.rec, denom: monthAgg.pillarDenominators.rec, avg: monthAvg.rec, max: 25 },
            ].map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 px-3 py-1.5 border-b last:border-0 items-center">
                <span>{p.label}</span>
                <span className="w-24 text-right tabular-nums">{p.sum.toLocaleString()}</span>
                <span className={`w-24 text-right tabular-nums ${p.denom !== monthAgg.infoSi ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>
                  {p.denom}
                  {p.denom !== monthAgg.infoSi && <span className="text-[10px]"> *</span>}
                </span>
                <span className="w-20 text-right tabular-nums font-semibold">{p.avg.toFixed(2)}</span>
                <span className="w-16 text-right tabular-nums text-muted-foreground">/ {p.max}</span>
              </div>
            ))}
            <div className="px-3 py-2 bg-muted/20 text-xs">
              <span className="text-amber-700">* Precio:</span> 11 tiendas no respondieron ningún precio → no entran al promedio de ese pilar (denominador 204, no 215).
            </div>
          </div>
        </div>
      </details>
    </div>
  )
}

export default async function PillarTreePage() {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single()

  if (profile?.role !== 'treid_admin') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <PillarTreeRootDiagram />
      <ScoringExample />
      <PillarTreeEditor />
    </div>
  )
}
