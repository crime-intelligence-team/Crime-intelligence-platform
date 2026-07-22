import { NavLink, useLocation } from 'react-router-dom'
import {
  ClipboardList, Map, BarChart3, Shield,
  HelpCircle, Activity, AlertTriangle, Globe, LayoutGrid,
  Share2, Database, TriangleAlert, Settings, Terminal,
  Download, FileText, Lock, Eye,
} from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

type SidebarVariant = 'main' | 'geo' | 'network' | 'governance'

const MAIN_NAV = [
  { to: '/cases',     icon: ClipboardList,  label: 'Case Workspace'    },
  { to: '/map',       icon: Map,            label: 'Intelligence Map'  },
  { to: '/analytics', icon: BarChart3,      label: 'Threat Analytics'  },
  { to: '/governance',icon: Shield,         label: 'Governance'        },
]

const GEO_NAV = [
  { to: '/map',              icon: Globe,     label: 'Geo Intelligence'   },
  { to: '/map/district',     icon: LayoutGrid,label: 'Regional Dashboards'},
  { to: '/network',          icon: Share2,    label: 'Network Workspace'  },
]

const NETWORK_NAV = [
  { to: '/map',             icon: Globe,       label: 'Geo-Spatial'   },
  { to: '/network',         icon: Share2,      label: 'Network Map'   },
  { to: '/map/district',    icon: LayoutGrid,  label: 'Regional Ops'  },
  { to: '/network/registry',icon: Database,    label: 'Node Registry' },
  { to: '/analytics',       icon: TriangleAlert,label:'Risk Signals'  },
]

const GOVERNANCE_NAV = [
  { to: '/governance',             icon: Shield,    label: 'Security Posture'     },
  { to: '/governance/integrity',   icon: Eye,       label: 'Integrity Monitoring' },
  { to: '/governance/audit',       icon: FileText,  label: 'Global Audit'         },
  { to: '/governance/protocols',   icon: Settings,  label: 'Policy Engine'        },
  { to: '/governance/directives',  icon: Terminal,  label: 'Directives'           },
  { to: '/governance/access',      icon: Lock,      label: 'Access Control'       },
]

function variantConfig(variant: SidebarVariant) {
  switch (variant) {
    case 'geo':        return { nav: GEO_NAV,        title: 'Command Center', subtitle: 'Karnataka Operations' }
    case 'network':    return { nav: NETWORK_NAV,    title: 'SENTINEL',       subtitle: 'V3.8 Active'          }
    case 'governance': return { nav: GOVERNANCE_NAV, title: 'SENTINEL-IQ',    subtitle: 'National Security Suite' }
    default:           return { nav: MAIN_NAV,       title: 'Command Center', subtitle: 'Level 4 Clearance'    }
  }
}

function useVariant(): SidebarVariant {
  const { pathname } = useLocation()
  if (pathname.startsWith('/governance')) return 'governance'
  if (pathname.startsWith('/network'))    return 'network'
  if (pathname.startsWith('/map'))        return 'geo'
  return 'main'
}

export default function Sidebar() {
  const variant = useVariant()
  const { nav, title, subtitle } = variantConfig(variant)
  const { state, toggleEmergency } = useAppContext()

  return (
    <aside className="flex flex-col w-[220px] h-screen bg-surface-raised border-r border-surface-border shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-surface-border shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-surface-card border border-surface-border flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-sentinel-200" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-sentinel-50 tracking-wide leading-tight">{title}</p>
            <p className="text-[10px] text-sentinel-400 leading-tight truncate">{subtitle}</p>
          </div>
        </div>

        {/* Primary CTA */}
        {variant === 'main' && (
          <NavLink to="/cases/new" className="flex items-center justify-center gap-2 w-full py-1.5 px-3 rounded-lg bg-surface-card border border-surface-border text-xs font-medium text-sentinel-200 hover:text-sentinel-50 hover:bg-surface-hover transition-colors">
            <span className="text-base leading-none">+</span> New Investigation
          </NavLink>
        )}
        {variant === 'governance' && (
          <button className="flex items-center justify-center gap-2 w-full py-1.5 px-3 rounded-lg bg-surface-card border border-surface-border text-xs font-medium text-sentinel-200 hover:bg-surface-hover transition-colors">
            <FileText className="w-3.5 h-3.5" /> Generate Report
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/map' || item.to === '/network' || item.to === '/governance'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                  : 'text-sentinel-300 hover:text-sentinel-100 hover:bg-surface-hover border border-transparent'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-3 border-t border-surface-border pt-3 space-y-0.5">
        {variant === 'network' ? (
          <>
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover w-full transition-colors">
              <Activity className="w-4 h-4" /> System Health
            </button>
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover w-full transition-colors">
              <Terminal className="w-4 h-4" /> Terminal
            </button>
            <button className="flex items-center justify-center gap-2 mt-2 w-full py-2 rounded-lg bg-surface-card border border-surface-border text-xs font-medium text-sentinel-200 hover:bg-surface-hover transition-colors">
              <Download className="w-3.5 h-3.5" /> Export Data
            </button>
          </>
        ) : variant === 'governance' ? (
          <>
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover w-full transition-colors">
              <Activity className="w-4 h-4" /> System Health
            </button>
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover w-full transition-colors">
              <HelpCircle className="w-4 h-4" /> Support
            </button>
          </>
        ) : (
          <>
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover w-full transition-colors">
              <HelpCircle className="w-4 h-4" /> Help Center
            </button>
            <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover w-full transition-colors">
              <Activity className="w-4 h-4" /> System Status
            </button>
            <button
              onClick={toggleEmergency}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium w-full transition-colors mt-1 ${
                state.emergencyMode
                  ? 'bg-severity-critical/10 text-severity-critical border border-severity-critical/30 animate-pulse'
                  : 'text-accent-rose hover:bg-accent-rose/10 animate-pulse-glow'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{state.emergencyMode ? 'Cancel Emergency' : 'Emergency Alert'}</span>
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
