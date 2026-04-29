import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, List, MapPin } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  if (profile?.role !== 'treid_admin') {
    redirect('/dashboard')
  }

  const settingsItems = [
    {
      title: 'Usuarios',
      description: 'Gestionar usuarios, roles y asignaciones de zona',
      href: '/settings/users',
      icon: Users,
    },
    {
      title: 'Listas Configurables',
      description: 'Materiales, oportunidades, tipos de campaña y motivos de egreso',
      href: '/settings/lists',
      icon: List,
    },
    {
      title: 'Actualizar Locales',
      description: 'Gestión de la base de locales y sincronización con Datascope',
      href: '/locations',
      icon: MapPin,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">Administra el sistema</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
