import { PropuestaCategoryPage } from '@/components/propuestas-treid/category-page'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <PropuestaCategoryPage
      category="cartel-interno"
      title="Propuestas Cartel Interno"
      subtitle="Señalética y carteles propuestos para interior"
    />
  )
}
