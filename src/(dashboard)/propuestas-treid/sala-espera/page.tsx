import { PropuestaCategoryPage } from '@/components/propuestas-treid/category-page'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <PropuestaCategoryPage
      category="sala-espera"
      title="Propuestas Sala de Espera"
      subtitle="Mobiliario y decoración propuestos para salas de espera"
    />
  )
}
