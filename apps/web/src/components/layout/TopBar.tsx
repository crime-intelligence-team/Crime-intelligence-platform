import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, Bell, Settings, HelpCircle, Shield, AlertTriangle } from 'lucide-react'
import { NotificationsPanel } from '../ui/NotificationsPanel'
import { useAlerts, useAppContext } from '../../context/AppContext'
import { useRealtimeAlerts } from '../../hooks/useRealtimeAlerts'

const placeholderMap: Record<string, string> = {
  '/cases':       'Search entities or cases...',
  '/map':         'Search districts, entities, or incident IBs...',
  '/network':     'Search nodes, alerts...',
  '/analytics':   'Search analytics...',
  '/governance':  'Search logs...',
}

function usePlaceholder() {
  const { pathname } = useLocation()
  for (const [prefix, label] of Object.entries(placeholderMap)) {
    if (pathname.startsWith(prefix)) return label
  }
  return 'Global Search...'
}

function useIsGovernance() {
  return useLocation().pathname.startsWith('/governance')
}

export default function TopBar() {
  const placeholder    = usePlaceholder()
  const isGov          = useIsGovernance()
  const [notifOpen, setNotifOpen] = useState(false)
  const { unreadCount } = useAlerts()
  const { state, toggleEmergency } = useAppContext()

  // Start real-time alert simulation (30s interval)
  useRealtimeAlerts(30_000)

  return (
    <header className="flex items-center justify-between h-14 px-5 bg-surface-raised border-b border-surface-border shrink-0 gap-4">
      {/* Brand */}
      {isGov ? (
        <span className="text-base font-bold text-sentinel-50 tracking-tight whitespace-nowrap shrink-0">
          Sentinel Governance
        </span>
      ) : (
        <span className="text-sm font-bold text-sentinel-50 tracking-tight whitespace-nowrap shrink-0 hidden md:block">
          Sentinel Intelligence
        </span>
      )}

      {/* Emergency mode banner */}
      {state.emergencyMode && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-severity-critical/15 border border-severity-critical/40 rounded-lg animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-severity-critical" />
          <span className="text-xs font-semibold text-severity-critical tracking-wide uppercase">Emergency Protocol Active</span>
        </div>
      )}

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sentinel-400" />
        <input
          type="text"
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs text-sentinel-100 placeholder-sentinel-500 focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-colors"
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Live notification bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(v => !v)}
            className={`relative p-2 rounded-lg transition-colors ${notifOpen ? 'bg-surface-hover text-sentinel-100' : 'text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover'}`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-severity-critical text-[9px] font-bold text-white leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} />
        </div>

        {isGov && (
          <button className="p-2 rounded-lg text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover transition-colors">
            <Shield className="w-4 h-4" />
          </button>
        )}
        <button className="p-2 rounded-lg text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover transition-colors">
          <Settings className="w-4 h-4" />
        </button>
        <button className="p-2 rounded-lg text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover transition-colors">
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Avatar — click toggles emergency (demo only) */}
        <button
          onClick={toggleEmergency}
          title="Toggle Emergency Mode"
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-surface-hover transition-colors"
        >
          <div className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${state.emergencyMode ? 'bg-severity-critical/20 border-severity-critical/50' : 'bg-accent-blue/20 border-accent-blue/30'}`}>
            <Shield className={`w-3.5 h-3.5 ${state.emergencyMode ? 'text-severity-critical' : 'text-accent-blue'}`} />
          </div>
        </button>
      </div>
    </header>
  )
}
