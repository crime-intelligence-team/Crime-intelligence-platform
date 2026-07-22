import { NavLink } from 'react-router-dom'

const TABS = [
  { label: 'Integrity',  to: '/governance/integrity'  },
  { label: 'Audit Logs', to: '/governance/audit'       },
  { label: 'Protocols',  to: '/governance/protocols'   },
  { label: 'Directives', to: '/governance/directives'  },
  { label: 'Access',     to: '/governance/access'      },
]

export function GovernanceSubNav() {
  return (
    <nav className="flex items-center gap-0.5 px-4 bg-surface-raised border-b border-surface-border shrink-0 overflow-x-auto">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              isActive
                ? 'border-accent-blue text-sentinel-50'
                : 'border-transparent text-sentinel-400 hover:text-sentinel-200 hover:border-surface-border'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
