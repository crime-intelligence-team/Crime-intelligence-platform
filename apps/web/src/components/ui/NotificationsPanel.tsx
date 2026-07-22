import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, BellOff, CheckCheck, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { useAlerts } from '../../context/AppContext'
import type { GlobalAlert } from '../../context/AppContext'

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  return `${Math.round(diff / 3600)}h ago`
}

const severityIcon = {
  critical: <AlertTriangle className="w-3.5 h-3.5 text-severity-critical shrink-0 mt-0.5" />,
  elevated: <AlertCircle   className="w-3.5 h-3.5 text-severity-elevated shrink-0 mt-0.5" />,
  low:      <Info          className="w-3.5 h-3.5 text-sentinel-400     shrink-0 mt-0.5" />,
}
const severityBorder = {
  critical: 'border-l-severity-critical',
  elevated: 'border-l-severity-elevated',
  low:      'border-l-transparent',
}

function AlertRow({ alert, onClose }: { alert: GlobalAlert; onClose: () => void }) {
  const { markRead, dismissAlert } = useAlerts()
  const navigate = useNavigate()

  function handleClick() {
    markRead(alert.id)
    if (alert.caseId) navigate(`/cases/${alert.caseId}`)
    else if (alert.nodeId) navigate('/network')
    onClose()
  }

  return (
    <div
      onClick={handleClick}
      className={`flex gap-3 p-3 border-b border-surface-border hover:bg-surface-hover cursor-pointer transition-colors border-l-2 ${severityBorder[alert.severity]} ${alert.read ? 'opacity-60' : ''}`}
    >
      {severityIcon[alert.severity]}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-medium leading-snug ${alert.read ? 'text-sentinel-300' : 'text-sentinel-50'}`}>
            {alert.title}
          </p>
          <button
            onClick={e => { e.stopPropagation(); dismissAlert(alert.id) }}
            className="p-0.5 rounded text-sentinel-600 hover:text-sentinel-300 shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <p className="text-[10px] text-sentinel-400 mt-0.5 leading-relaxed line-clamp-2">{alert.description}</p>
        <p className="text-[10px] text-sentinel-600 mt-1">{timeAgo(alert.timestamp)}</p>
      </div>
      {!alert.read && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue shrink-0 mt-1" />}
    </div>
  )
}

interface NotificationsPanelProps {
  open: boolean
  onClose: () => void
}

export function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
  const { alerts, markAllRead, unreadCount } = useAlerts()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 w-[340px] bg-surface-raised border border-surface-border rounded-xl shadow-2xl z-50 flex flex-col max-h-[480px] animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-sentinel-50">Alerts</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-severity-critical text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={markAllRead} className="flex items-center gap-1 text-[10px] text-sentinel-400 hover:text-sentinel-200 px-2 py-1 rounded hover:bg-surface-hover transition-colors">
            <CheckCheck className="w-3 h-3" /> Mark all read
          </button>
          <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200 hover:bg-surface-hover">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-sentinel-500">
            <BellOff className="w-8 h-8 mb-2" />
            <p className="text-xs">No alerts</p>
          </div>
        ) : (
          alerts.map(a => <AlertRow key={a.id} alert={a} onClose={onClose} />)
        )}
      </div>
    </div>
  )
}
