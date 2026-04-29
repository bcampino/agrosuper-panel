import { Card, CardContent } from '@/components/ui/card'
import { Search } from 'lucide-react'

export default function RutasMysteryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Rutas Mystery Shopper</h1>
        <p className="text-muted-foreground">Planificación y seguimiento de rutas de mystery shoppers</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold text-muted-foreground">Próximamente</h2>
          <p className="text-sm text-muted-foreground/70 max-w-md mt-2">
            Este módulo permitirá planificar y hacer seguimiento de las rutas de mystery shoppers.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
