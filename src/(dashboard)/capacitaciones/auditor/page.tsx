import { ClipboardList } from 'lucide-react'
import { CapacitacionLayout } from '@/components/capacitaciones/capacitacion-layout'

export default function AuditorPage() {
  return (
    <CapacitacionLayout
      category="Capacitaciones"
      title="Qué hace un auditor de Shell"
      subtitle="Funciones, rutas y responsabilidades del gestor en terreno"
      icon={ClipboardList}
      color="#eab721"
      lessons={[
        {
          title: 'Rol del auditor',
          body: [
            'Visitar los locales asignados según la ruta semanal.',
            'Levantar información estandarizada usando el formulario 3.0 en Datascope.',
            'Verificar disponibilidad, exhibición, precios y recomendación de Shell vs competencia.',
            'Instalar material POP entregado (pendones, flejeras, stoppers, muebles).',
            'Detectar oportunidades comerciales en cada local y registrarlas.',
          ],
        },
        {
          title: 'Cómo se organiza la ruta',
          body: [
            'Cada gestor recibe su ruta mensual con los locales asignados por zona.',
            'El orden recomendado es por proximidad geográfica para optimizar tiempos de traslado.',
            'Se debe visitar cada local una vez por mes como mínimo. Revisitas permitidas si queda algo pendiente.',
            'La meta estándar es 8-12 locales por día dependiendo de la zona.',
          ],
        },
        {
          title: 'Qué debe llevar siempre',
          body: [
            'Uniforme Shell completo (polera, credencial).',
            'Kit de limpieza básico para muebles Shell (paño y desinfectante).',
            'Material POP del mes (pendones, flejeras, tarjetas de cambio).',
            'Celular cargado con Datascope instalado y sincronizado.',
            'Medidor de precios y formulario respaldado en papel por si falla la app.',
          ],
        },
        {
          title: 'Actitud en terreno',
          body:
            'El auditor representa a Shell/ENEX frente al locatario. Debe ser cordial, puntual y profesional. Siempre saludar al encargado, explicar brevemente la visita, pedir permiso para fotografiar y agradecer al salir. Si el locatario se niega, registrar el motivo en el formulario y pasar al siguiente.',
        },
        {
          title: 'Qué NO hacer',
          body: [
            'No responder el formulario si no se ingresó al local.',
            'No inventar respuestas cuando hay falta de información.',
            'No prometer material ni campañas que no estén confirmadas por Treid.',
            'No dejar material POP sin permiso del encargado.',
            'No modificar fotos ni reusar fotos de visitas anteriores.',
          ],
        },
      ]}
    />
  )
}
