import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, Settings, HelpCircle, Shield, AlertTriangle, Loader2 } from 'lucide-react'
import { NotificationsPanel } from '../ui/NotificationsPanel'
import { useAlerts, useAppContext } from '../../context/AppContext'
import { useApi } from '../../hooks/useApi'
import { searchApi } from '../../services/endpoints'
import { Breadcrumb } from './Breadcrumb'

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

  // Global search (Phase 5): debounced aggregator over cases/entities/districts.
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300)
    return () => clearTimeout(t)
  }, [q])
  const active = debounced.trim().length >= 2
  const { data: results, loading } = useApi(
    () => (active ? searchApi.global(debounced.trim(), undefined, 1, 6) : Promise.resolve(null)),
    [debounced, active],
  )

  function go(path: string) {
    setQ('')
    setDebounced('')
    setFocused(false)
    navigate(path)
  }

  const showResults = active && focused

  return (
    <header className="flex items-center justify-between h-14 px-5 bg-surface-raised border-b border-surface-border shrink-0 gap-4">
      {/* Brand + Breadcrumb */}
      <div className="flex flex-col justify-center shrink-0 min-w-0">
        <span className="text-xs font-bold text-sentinel-50 tracking-tight whitespace-nowrap leading-tight">
          {isGov ? 'Sentinel Governance' : 'Sentinel Intelligence'}
        </span>
        <Breadcrumb />
      </div>

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
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="w-full pl-9 pr-4 py-1.5 bg-surface-card border border-surface-border rounded-lg text-xs focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-colors"
        />

        {showResults && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface-raised border border-surface-border rounded-xl shadow-2xl overflow-hidden z-50">
            {loading ? (
              <div className="px-4 py-3 flex items-center gap-2 text-xs text-sentinel-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
              </div>
            ) : !results || (!results.cases?.total && !results.entities?.total && !results.districts?.total) ? (
              <div className="px-4 py-3 text-xs text-sentinel-500">No matches for “{debounced.trim()}”.</div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-surface-border">
                {results.cases && results.cases.items.length > 0 && (
                  <div className="py-1.5">
                    <div className="px-4 py-1 text-[10px] font-bold tracking-wider text-sentinel-500">CASES</div>
                    {results.cases.items.map(c => (
                      <button key={c.id} onClick={() => go(`/cases/${c.id}`)}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-hover transition-colors text-left">
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-medium text-sentinel-100 truncate">{c.case_number} — {c.title}</span>
                          <span className="block font-mono text-[10px] text-sentinel-500">{c.status} · {c.classification.replace(/_/g, ' ')}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {results.entities && results.entities.items.length > 0 && (
                  <div className="py-1.5">
                    <div className="px-4 py-1 text-[10px] font-bold tracking-wider text-sentinel-500">ENTITIES</div>
                    {results.entities.items.map(e => (
                      <button key={e.id} onClick={() => go('/network')}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-hover transition-colors text-left">
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-medium text-sentinel-100 truncate">{e.label}</span>
                          <span className="block font-mono text-[10px] text-sentinel-500">{e.type} · {e.classification.replace(/_/g, ' ')}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {results.districts && results.districts.items.length > 0 && (
                  <div className="py-1.5">
                    <div className="px-4 py-1 text-[10px] font-bold tracking-wider text-sentinel-500">DISTRICTS</div>
                    {results.districts.items.map(d => (
                      <button key={d.id} onClick={() => go(`/map/district/${d.id}`)}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface-hover transition-colors text-left">
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-medium text-sentinel-100 truncate">{d.name}</span>
                          <span className="block font-mono text-[10px] text-sentinel-500">{d.code} · {d.classification.replace(/_/g, ' ')}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
