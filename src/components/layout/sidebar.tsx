'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu, X, LayoutDashboard, Megaphone, ShoppingBag,
  Lightbulb, TrendingUp, Gift, Truck, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

interface SidebarGroup {
  label: string
  color: string
  items: SidebarItem[]
}

const NAV_GROUPS: SidebarGroup[] = [
  {
    label: 'Principal',
    color: 'var(--primary)',
    items: [
      { label: 'Dashboard', href: '/agrosuper', icon: LayoutDashboard },
      { label: 'Campañas', href: '/agrosuper/campaigns', icon: Megaphone },
    ],
  },
  {
    label: 'Próximamente',
    color: 'var(--accent)',
    items: [
      { label: 'Propuestas Treid', href: '#', icon: ShoppingBag, disabled: true },
      { label: 'Oportunidades',    href: '#', icon: Lightbulb,   disabled: true },
      { label: 'Ventas',           href: '#', icon: TrendingUp,  disabled: true },
      { label: 'Incentivos FFVV',  href: '#', icon: Gift,        disabled: true },
      { label: 'Incentivos B2B',   href: '#', icon: Gift,        disabled: true },
      { label: 'Solicitudes',      href: '#', icon: Truck,       disabled: true },
    ],
  },
]

const SIDEBAR_BG = 'linear-gradient(180deg, #1E2C3E 0%, #2A3A50 60%, #354A66 100%)'
const W_EXPANDED = 220
const W_COLLAPSED = 56

function NavContent({ pathname, collapsedGroups, toggleGroup, collapsed }: {
  pathname: string
  collapsedGroups: Set<string>
  toggleGroup: (label: string) => void
  collapsed: boolean
}) {
  return (
    <>
      {/* Logo */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
           className="flex h-16 items-center gap-3 px-3 shrink-0 overflow-hidden">
        <div className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs shrink-0"
             style={{ background: 'linear-gradient(135deg, #007BFF, #1E2C3E)' }}>
          AS
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">Agrosuper</div>
            <div className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>Campañas POP</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_GROUPS.map((group) => {
          const isCollapsed = collapsedGroups.has(group.label)

          return (
            <div key={group.label} className="mb-1">
              {/* Section header — hidden when sidebar is collapsed */}
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center gap-2 px-3 py-2 mt-2 mb-0.5 rounded-lg transition-colors"
                  style={{ color: group.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: group.color }} />
                  <span className="flex-1 text-left text-[10px] font-bold uppercase tracking-widest truncate">
                    {group.label}
                  </span>
                  {isCollapsed
                    ? <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
                    : <ChevronDown  className="h-3 w-3 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />}
                </button>
              )}

              {/* Items — show all when collapsed (icon-only) */}
              {(!isCollapsed || collapsed) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

                    if (item.disabled) {
                      return (
                        <div key={item.label}
                             title={collapsed ? item.label : undefined}
                             className={cn(
                               'flex items-center rounded-lg py-2 text-[13px] font-medium',
                               collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                             )}
                             style={{ color: 'rgba(255,255,255,0.35)' }}>
                          <Icon className="h-4 w-4 shrink-0" />
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{item.label}</span>
                              <span className="text-[10px] font-semibold uppercase tracking-wide shrink-0"
                                    style={{ color: 'rgba(249,115,22,0.7)' }}>Pronto</span>
                            </>
                          )}
                        </div>
                      )
                    }

                    return (
                      <Link key={item.href} href={item.href}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                              'flex items-center rounded-lg py-2 text-[13px] font-medium transition-colors',
                              collapsed ? 'justify-center px-0' : 'gap-3 px-3'
                            )}
                            style={{
                              backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                              color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                            }}>
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {isActive && <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-400" />}
                          </>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Panel Agrosuper v1.0
          </p>
        </div>
      )}
    </>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(false)

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <>
      {/* ── DESKTOP sidebar ── */}
      <aside
        className="hidden md:flex flex-col shrink-0 relative transition-all duration-200"
        style={{ width: collapsed ? W_COLLAPSED : W_EXPANDED, background: SIDEBAR_BG }}
      >
        <NavContent
          pathname={pathname}
          collapsedGroups={collapsedGroups}
          toggleGroup={toggleGroup}
          collapsed={collapsed}
        />

        {/* Toggle collapse button */}
        <button
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          className="absolute -right-3 top-[72px] z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-md transition-colors"
          style={{
            background: '#1B2B4A',
            borderColor: 'rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          {collapsed
            ? <PanelLeftOpen  className="h-3.5 w-3.5" />
            : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* ── MOBILE hamburger ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg text-white shadow-lg"
        style={{ background: '#1B2B4A' }}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── MOBILE overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── MOBILE sidebar ── */}
      <aside
        className="md:hidden fixed inset-y-0 left-0 z-50 flex flex-col transition-transform duration-300"
        style={{
          width: W_EXPANDED,
          background: SIDEBAR_BG,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <div className="flex items-center justify-end px-3 pt-3 shrink-0">
          <button onClick={() => setMobileOpen(false)} className="p-1 rounded text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavContent
          pathname={pathname}
          collapsedGroups={collapsedGroups}
          toggleGroup={toggleGroup}
          collapsed={false}
        />
      </aside>
    </>
  )
}
