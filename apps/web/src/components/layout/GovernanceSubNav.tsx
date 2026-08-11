import { NavLink } from 'react-router-dom'

const TABS = [
  { label: 'Security',   to: '/governance'             },
  { label: 'Reviews',    to: '/governance/integrity'   },
  { label: 'Audit Logs', to: '/governance/audit'       },
  { label: 'Directory',  to: '/governance/protocols'   },
  { label: 'Access',     to: '/governance/access'      },
  { label: 'Resolution', to: '/governance/resolution'  },
]

export function GovernanceSubNav() {
  return (
    <nav className="flex items-center gap-0.5 px-4 bg-surface-raised border-b border-surface-border shrink-0 overflow-x-auto">
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/governance'}
          className={({ isActive }) =>
            `relative px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-all duration-150 ${
              isActive
                ? 'text-accent-blue'
                : 'text-sentinel-400 hover:text-sentinel-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {tab.label}
              {/* Active underline with glow */}
              <span
                className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-blue opacity-100'
                    : 'bg-transparent opacity-0'
                }`}
                style={isActive ? { boxShadow: '0 0 8px 1px rgba(59,130,246,0.6)' } : {}}
              />
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
