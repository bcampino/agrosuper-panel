import { FileQuestion } from 'lucide-react'
import { CapacitacionLayout } from '@/components/capacitaciones/capacitacion-layout'

export default function FormularioPage() {
  return (
    <CapacitacionLayout
      category="Capacitaciones"
      title="Cómo responder el formulario"
      subtitle="Guía paso a paso para levantar auditorías correctamente"
      icon={FileQuestion}
      color="#6b91cb"
      lessons={[
        {
          title: 'Identificación del local',
          body: [
            'Verificar el código del local contra la ruta. Si el local cambió de dueño o no corresponde, reportarlo.',
            'Tomar SIEMPRE una foto de fachada antes de entrar, con luz natural y visible todo el frente.',
            'Confirmar si el local se encontraba abierto. Si no se logró levantamiento, registrar la razón (cerrado, no permite, cambió de dueño, etc.).',
          ],
        },
        {
          title: 'Disponibilidad (DISP)',
          body: [
            'HX7, HX8, Ultra: responder una pregunta por producto.',
            '"Sí, visible en góndola" = el producto está a la vista del cliente (10 pts).',
            '"Sí, en bodega / quiebre" = lo vende pero no está exhibido hoy (2 pts).',
            '"No vende" = nunca lo ha vendido (0 pts).',
            'Tomar foto del producto en góndola cuando esté visible.',
          ],
        },
        {
          title: 'Exhibición y POP',
          body: [
            'Bastidor Shell con nombre del local: foto completa del cartel.',
            'Letrero externo Shell: foto del letrero o cenefa.',
            'Mueble Shell / payloader: verificar que no tiene productos de la competencia y que está en buen estado.',
            'Pendón Helix y pendón Rímula: foto de cada uno si existe.',
            'Todos en buen estado (EXH-08): se evalúa si el cartel con nombre, el mueble, el pendón Helix y el pendón Rímula están en buen estado. Todos Sí → 100 pts · alguno No → 33 pts · todos No → 0 pts.',
          ],
        },
        {
          title: 'Precio y comparación con competencia',
          body: [
            'Registrar el precio que el locatario vende al público de HX7, HX8, Ultra.',
            'Pedir o medir también el precio de los productos Mobil equivalentes (Super 2000, Super 3000, Mobil 1 ESP).',
            'Precio visible = hay etiqueta con el precio exhibido en la góndola (1 pt adicional).',
            'Shell HX7 debe costar igual o menos que Mobil Super 2000 para sacar puntaje máximo.',
          ],
        },
        {
          title: 'Recomendación (Mystery shopper)',
          body:
            'La recomendación se mide en un formulario SEPARADO (Mystery Shopper). Ahí se registra qué marca de lubricante recomienda el locatario al comprador. Shell en 1era posición = 25 pts. En 2da = 15 pts. En 3era = 10 pts. Si no aparece Shell = 0 pts.',
        },
        {
          title: 'Fotos que SIEMPRE deben estar',
          body: [
            'Fachada del local.',
            'Productos Shell en góndola (uno por SKU que vende).',
            'Mueble Shell si existe.',
            'Pendones Helix / Rímula si están instalados.',
            'Bastidor y/o letrero externo con marca Shell.',
          ],
        },
        {
          title: 'Errores comunes a evitar',
          body: [
            'Responder "Sí" sin foto de respaldo.',
            'Dejar precios vacíos cuando el locatario sí los dio.',
            'Marcar el mueble "en buen estado" sin fotografiarlo completo.',
            'Olvidar mencionar competencia (Mobil, Castrol, etc.) en las observaciones.',
            'No registrar el motivo cuando no se pudo levantar información.',
          ],
        },
      ]}
    />
  )
}
