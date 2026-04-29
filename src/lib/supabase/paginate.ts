/**
 * Paginación para queries de Supabase.
 *
 * Supabase/PostgREST tiene un hard limit de 1000 rows por request
 * e **ignora** `.limit(5000)` o `.limit(10000)`. Esta función pagina
 * automáticamente llamando al builder con `.range(from, to)` hasta
 * que no queden más filas.
 *
 * Uso:
 *   const rows = await fetchAllPages<Audit>((from, to) =>
 *     supabase.from('audits').select('*').eq('form', '664005').range(from, to)
 *   )
 *
 * IMPORTANT: el builder debe aplicar `.range()` al final — el resto de
 * filtros/orderings van antes. El builder se llama una vez por página.
 */
export async function fetchAllPages<T>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await queryFn(offset, offset + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}
