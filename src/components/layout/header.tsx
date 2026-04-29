'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/agrosuper': 'Resultados',
  '/agrosuper/audits': 'Auditorías',
  '/agrosuper/settings': 'Configuración',
}

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = []

  const basePath = '/' + pathname.split('/').filter(Boolean).slice(0, 2).join('/')
  const baseTitle = PAGE_TITLES[basePath]

  if (baseTitle && basePath !== '/agrosuper') {
    crumbs.push({ label: baseTitle, href: basePath })
  }

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length > 2) {
    if (segments[2] === 'review') {
      crumbs.push({ label: 'Revisión' })
    } else {
      crumbs.push({ label: 'Detalle' })
    }
  }

  return crumbs
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(path + '/')) return title
  }
  return 'Panel Agrosuper'
}

export function Header() {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)
  const breadcrumbs = getBreadcrumbs(pathname)

  return (
    <header className="border-b border-border bg-white sticky top-0 z-30">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
          {breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              {breadcrumbs.map((crumb, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  {idx > 0 && <span className="text-muted-foreground">/</span>}
                  <span>{crumb.label}</span>
                </div>
              ))}
            </nav>
          )}
        </div>
      </div>
    </header>
  )
}
