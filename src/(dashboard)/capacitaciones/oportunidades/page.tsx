import { Lightbulb } from 'lucide-react'
import { CapacitacionLayout } from '@/components/capacitaciones/capacitacion-layout'

export default function OportunidadesPage() {
  return (
    <CapacitacionLayout
      category="Capacitaciones"
      title="Cómo detectar oportunidades"
      subtitle="Qué observar en el local para proponer mejoras de POP y venta"
      icon={Lightbulb}
      color="#e74c3c"
      lessons={[
        {
          title: 'Qué es una oportunidad',
          body:
            'Una oportunidad es cualquier acción concreta que podemos proponer al local para mejorar su desempeño Shell: instalar un mueble, agregar un pendón, capacitar al locatario, reordenar la góndola. Se registran para que Treid o el Comercial Enex las ejecute después.',
        },
        {
          title: 'Tipos de oportunidades frecuentes',
          body: [
            'Mueble Shell faltante (sujeto a compra mínima: 6 cajas payloader / 12 cajas exhibidor).',
            'Bastidor externo o letrero Shell cuando hay otra marca dominando la fachada.',
            'Pendones Helix/Rímula si el local vende el producto pero no lo comunica.',
            'Flejeras, stoppers y stickers en góndola sin branding Shell.',
            'Capacitación de venta si el locatario recomienda otra marca en primer lugar.',
            'Capacitación de exhibición cuando tiene el producto en bodega y no en góndola.',
            'Ordenamiento de góndola: limpiar, descontaminar y dejar espacio Shell dedicado.',
          ],
        },
        {
          title: 'Qué NO se propone',
          body: [
            'Merchandising personal (overoles, jockey, frisbees) — no se promete sin confirmación.',
            'Precio visible — no se trata como oportunidad formal.',
            'Pendón de un producto que el local no vende (ej: Rímula si solo vende auto).',
            'Cambios de fachada si el locatario ya rechazó antes.',
          ],
        },
        {
          title: 'Cómo mirar el local con ojo de oportunidad',
          body: [
            'Fachada: ¿la marca que domina es Shell o la competencia?',
            'Entrada y counter: ¿hay bastidor/cartel con nombre del local que incluya Shell?',
            'Góndola de lubricantes: ¿está ordenada? ¿hay flejeras? ¿el mueble está descontaminado?',
            'Mostrador: ¿está el pendón Helix? ¿se ve el brochure?',
            'Conversación con el locatario: ¿qué recomienda? ¿por qué? ¿qué le falta para vender más Shell?',
          ],
        },
        {
          title: 'Cómo registrarla',
          body:
            'En el formulario 3.0, en la sección "Oportunidades", describir brevemente qué se vio y qué se propone. Incluir foto de evidencia (espacio disponible, mueble de competencia, etc.). La IA del panel revisa estas oportunidades y las sugiere al aprobar la auditoría, pero tu observación en terreno es clave: lo que tú viste en el local vale más que lo que la IA interpreta de una foto.',
        },
      ]}
    />
  )
}
