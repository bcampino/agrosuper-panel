import {
  LayoutDashboard,
  BarChart3,
  FileText,
  Lightbulb,
  Megaphone,
  Bell,
  Mail,
  Truck,
  Route,
  Search,
  Dices,
  TrendingUp,
  Gift,
  Package,
  MapPin,
  GitBranch,
  Users,
  Settings,
  ClipboardCheck,
  GraduationCap,
  UserCircle,
  ShoppingBag,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/types'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  comingSoon?: boolean
  external?: boolean
}

export interface NavGroup {
  label: string
  color: string
  items: NavItem[]
  roles: UserRole[] | 'all'
}

interface NavItemConfig extends NavItem {
  roles: UserRole[] | 'all'
}

interface NavGroupConfig {
  label: string
  color: string
  roles: UserRole[] | 'all'
  items: NavItemConfig[]
}

// Enex palette: #d0661c (orange) #eab721 (yellow) #8e3687 (purple) #6b91cb (blue) #aac44a (green)
const NAV_GROUPS: NavGroupConfig[] = [
  {
    label: 'Dashboard',
    color: '#6b91cb',
    roles: 'all',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: 'all' },
    ],
  },
  {
    label: 'Perfect Store',
    color: '#d0661c',
    roles: 'all',
    items: [
      { label: 'Resultados',           href: '/analytics',        icon: BarChart3,    roles: ['treid_admin', 'enex_admin'] },
      { label: 'Hoja de Vida Locales', href: '/locations',        icon: FileText,     roles: 'all' },
      { label: 'Oportunidades',        href: '/opportunities',    icon: Lightbulb,    roles: ['treid_admin', 'enex_admin'] },
      { label: 'Campañas Treid',       href: '/campaigns',        icon: Megaphone,    roles: 'all' },
      { label: 'Alertas',              href: '/alertas',          icon: Bell,         roles: ['treid_admin'], comingSoon: true },
      { label: 'Automatizaciones',     href: '/automatizaciones', icon: Mail,         roles: ['treid_admin'], comingSoon: true },
      { label: 'Propuestas Treid',     href: '/propuestas-treid', icon: ShoppingBag,  roles: ['treid_admin'] },
    ],
  },
  {
    label: 'Equipo Enex',
    color: '#aac44a',
    roles: ['treid_admin', 'enex_admin'],
    items: [
      { label: 'Ventas',          href: '/ventas',          icon: TrendingUp, roles: ['treid_admin', 'enex_admin'], comingSoon: true },
      { label: 'Incentivos FFVV', href: '/incentivos-ffvv', icon: Gift,       roles: 'all', comingSoon: true },
      { label: 'Incentivos B2B',  href: '/incentivos-b2b',  icon: Gift,       roles: 'all', comingSoon: true },
      { label: 'Bodega Treid',    href: '/inventory',       icon: Package,    roles: ['treid_admin', 'enex_admin'] },
      { label: 'Solicitudes',     href: '/solicitudes',     icon: Truck,      roles: 'all', comingSoon: true },
      { label: 'Usuarios Enex',   href: '/usuarios-enex',   icon: Users,      roles: ['treid_admin', 'enex_admin'] },
    ],
  },
  {
    label: 'Equipo Treid',
    color: '#6b91cb',
    roles: ['treid_admin', 'treid_operations', 'treid_implementador'],
    items: [
      { label: 'Revisión Auditorías', href: '/audits',                   icon: ClipboardCheck, roles: ['treid_admin', 'treid_operations'] },
      { label: 'Revisión Mystery',    href: '/mystery',                  icon: Search,         roles: ['treid_admin', 'treid_operations'] },
      { label: 'Rutas Gestores',      href: '/rutas-gestor',             icon: Route,          roles: ['treid_admin'], comingSoon: true },
      { label: 'Gestores',            href: '/gestores',                 icon: UserCircle,     roles: ['treid_admin'] },
      { label: 'Capacitaciones',      href: '/capacitaciones',           icon: GraduationCap,  roles: ['treid_admin'] },
      { label: 'Logística',           href: '/logistica',                icon: Truck,          roles: ['treid_admin'] },
      { label: 'Ruleta Mystery',      href: 'https://treidenex.lovable.app/', icon: Dices,     roles: ['treid_admin'], external: true },
      { label: 'Mis Tareas',          href: '/implementador/tareas',     icon: ClipboardList,  roles: ['treid_implementador'] },
    ],
  },
  {
    label: 'Interno Treid',
    color: '#8e3687',
    roles: ['treid_admin'],
    items: [
      { label: 'Locales',       href: '/settings/locations', icon: MapPin,    roles: ['treid_admin'] },
      { label: 'Árbol Teórico', href: '/pillar-tree',        icon: GitBranch, roles: ['treid_admin'] },
      { label: 'Usuarios App',  href: '/settings/users',     icon: Users,     roles: ['treid_admin'] },
      { label: 'Listas',        href: '/settings/lists',     icon: Settings,  roles: ['treid_admin'] },
    ],
  },
]

export function getNavGroups(role: UserRole): NavGroup[] {
  return NAV_GROUPS
    .filter((group) => group.roles === 'all' || group.roles.includes(role))
    .map((group) => ({
      label: group.label,
      color: group.color,
      roles: group.roles,
      items: group.items
        .filter((item) => item.roles === 'all' || item.roles.includes(role))
        .map(({ label, href, icon, comingSoon, external }) => ({ label, href, icon, comingSoon, external })),
    }))
    .filter((group) => group.items.length > 0)
}
