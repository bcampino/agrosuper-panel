import { PropuestaCategoryPage } from '@/components/propuestas-treid/category-page'

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <PropuestaCategoryPage
      category="otras"
      title="Otras Propuestas"
      subtitle="Otro material propuesto"
    />
  )
}
