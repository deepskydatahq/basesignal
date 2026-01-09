import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Home, Route, Settings, Lock, BarChart3, ClipboardList } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

interface NavItemConfig {
  icon: React.ComponentType<{ className?: string }>
  label: string
  to: string
  requiresSetupComplete?: boolean
}

const navItems: NavItemConfig[] = [
  { icon: Home, label: 'Home', to: '/', requiresSetupComplete: true },
  { icon: Route, label: 'Journeys', to: '/journeys', requiresSetupComplete: true },
  { icon: ClipboardList, label: 'Measurement Plan', to: '/measurement-plan', requiresSetupComplete: true },
  { icon: BarChart3, label: 'Metrics', to: '/metric-catalog', requiresSetupComplete: true },
]

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  to: string
  expanded: boolean
  locked?: boolean
}

function NavItem({ icon: Icon, label, to, expanded, locked }: NavItemProps) {
  const location = useLocation()
  const isActive = to === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(to)

  if (locked) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg w-full
                text-gray-300 cursor-not-allowed
              `}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {expanded && (
                <>
                  <span className="text-sm font-medium flex-1">{label}</span>
                  <Lock className="w-3.5 h-3.5" />
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Complete setup to unlock</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Link
      to={to}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg w-full
        transition-colors
        ${isActive
          ? 'bg-gray-100 text-gray-900'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
      `}
      title={!expanded ? label : undefined}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {expanded && <span className="text-sm font-medium">{label}</span>}
    </Link>
  )
}

export function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const user = useQuery(api.users.current)

  const setupComplete = user?.setupStatus === 'complete'

  return (
    <aside
      className={`
        ${expanded ? 'w-48' : 'w-16'}
        border-r border-gray-200 bg-white
        flex flex-col py-4
        transition-all duration-200
        flex-shrink-0
      `}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="flex items-center justify-center mb-6 px-3">
        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">B</span>
        </div>
        {expanded && (
          <span className="ml-3 text-sm font-semibold text-gray-900">Basesignal</span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex flex-col gap-1 px-2">
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            icon={item.icon}
            label={item.label}
            to={item.to}
            expanded={expanded}
            locked={item.requiresSetupComplete && !setupComplete}
          />
        ))}
      </nav>

      {/* Settings at bottom - always accessible */}
      <div className="mt-auto px-2">
        <NavItem
          icon={Settings}
          label="Settings"
          to="/settings"
          expanded={expanded}
          locked={false}
        />
      </div>
    </aside>
  )
}
