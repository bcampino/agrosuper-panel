import { Card, CardContent } from '@/components/ui/card'
import { Gift } from 'lucide-react'

export default function IncentivosFFVVPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Incentivos FFVV</h1>
        <p className="text-muted-foreground">Gestión de incentivos para fuerza de ventas</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Gift className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-semibold text-muted-foreground">Próximamente</h2>
          <p className="text-sm text-muted-foreground/70 max-w-md mt-2">
            Este módulo permitirá gestionar incentivos para la fuerza de ventas. Estará disponible en una próxima actualización.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
