import { HelpCircle } from 'lucide-react'
import { CapacitacionLayout } from '@/components/capacitaciones/capacitacion-layout'

export default function FaqPage() {
  return (
    <CapacitacionLayout
      category="Capacitaciones"
      title="Preguntas frecuentes"
      subtitle="Respuestas a dudas comunes sobre auditorías y procesos"
      icon={HelpCircle}
      color="#1f2a44"
      lessons={[
        {
          title: '¿Qué hago si el local está cerrado?',
          body: 'Tomar foto de la fachada cerrada, registrar en el formulario "No se logró levantamiento", indicar el motivo (cerrado, fin de semana, etc.) y reintentar en los siguientes días. Si al cabo de 3 intentos sigue cerrado, reportar a tu coordinador.',
        },
        {
          title: '¿Qué hago si el locatario no quiere responder?',
          body: 'Marcar "No permite levantamiento" en el formulario con el motivo. No insistir. Registrar qué se alcanzó a ver (fachada, productos visibles desde afuera) y seguir con la ruta.',
        },
        {
          title: '¿Puedo levantar en un local que no está en mi ruta?',
          body: 'No. Cada auditor tiene locales asignados. Si te llegan pedidos extra, confirmar con el coordinador antes de entrar.',
        },
        {
          title: '¿Y si el local cambió de dueño o giro?',
          body: 'Registrar el nuevo dueño o actividad en observaciones. Si el local dejó de vender lubricantes, reportarlo para que Treid lo dé de baja del panel.',
        },
        {
          title: '¿Cuántas fotos necesito por visita?',
          body: 'Mínimo 5: fachada, productos Shell en góndola (hasta 3), mueble o pendón, exterior si tiene bastidor/letrero Shell. Ideal entre 8 y 12. No hay máximo.',
        },
        {
          title: '¿Qué pasa si Datascope se cae?',
          body: 'Anotar las respuestas en papel o en notas del celular. Apenas vuelva la conexión, cargar el formulario. Si pasan más de 24 hrs sin conexión, coordinar con el equipo Treid.',
        },
        {
          title: '¿Puedo regalar material POP sin permiso?',
          body: 'No. Solo el material que te asignaron en tu kit del mes. Si el locatario pide más, registrar la oportunidad en el formulario y Treid coordinará la entrega posterior.',
        },
        {
          title: '¿Cuándo se me paga / cómo se cuentan mis visitas?',
          body: 'Se cuentan únicamente las auditorías aprobadas por el revisor de Treid (revisor automático IA + validación humana). Si la auditoría queda rechazada por fotos incoherentes o metadata inválida, tendrás que rehacerla.',
        },
        {
          title: '¿A quién contacto si tengo dudas?',
          body: 'A tu coordinador Treid directo. Para temas técnicos del panel o Datascope, escribir a soporte@treid.cl.',
        },
      ]}
    />
  )
}
