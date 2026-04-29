import { redirect } from 'next/navigation'
import { getCachedUser, getCachedProfile } from '@/lib/auth/session'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const authUser = await getCachedUser()

  if (!authUser) {
    redirect('/login')
  }

  const user = await getCachedProfile(authUser.id)

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6 bg-muted/40">
          {children}
        </main>
      </div>
    </div>
  )
}
