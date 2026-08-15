import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react'
import { alertsApi } from '../services/endpoints'
import { getAccessToken } from '../services/client'
import type { Alert } from '@cip/shared-types'

// ─── Types ────────────────────────────────────────────────────────────────────
export type AlertSeverity = 'critical' | 'elevated' | 'low'

export interface GlobalAlert {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  timestamp: string
  read: boolean
  caseId?: string
  nodeId?: string
  local?: boolean
}

const ALERT_TITLES: Record<string, string> = {
  resurfaced_offender: 'Resurfaced Offender',
  new_inter_district_link: 'New Inter-District Link',
  confidence_change: 'Confidence Change',
}

function backendAlertToGlobal(a: Alert): GlobalAlert {
  const severity: AlertSeverity = a.type === 'confidence_change' ? 'low' : 'elevated'
  return {
    id: a.id,
    severity,
    title: ALERT_TITLES[a.type] ?? a.type.replace(/_/g, ' ').toUpperCase(),
    description: a.summary,
    timestamp: a.created_at,
    read: false,
    nodeId: a.entity_id ?? undefined,
  }
}

interface AppState {
  alerts: GlobalAlert[]
  activeCaseId: string | null
  selectedNodeId: string | null
  systemStatus: 'nominal' | 'degraded' | 'critical'
  emergencyMode: boolean
}

type Action =
  | { type: 'ADD_ALERT'; payload: Omit<GlobalAlert, 'id' | 'timestamp' | 'read' | 'local'> }
  | { type: 'MARK_READ'; payload: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'DISMISS_ALERT'; payload: string }
  | { type: 'HYDRATE_ALERTS'; payload: GlobalAlert[] }
  | { type: 'SET_ACTIVE_CASE'; payload: string | null }
  | { type: 'SET_SELECTED_NODE'; payload: string | null }
  | { type: 'SET_SYSTEM_STATUS'; payload: AppState['systemStatus'] }
  | { type: 'TOGGLE_EMERGENCY' }

// ─── Initial state ────────────────────────────────────────────────────────────
// Alerts are hydrated from the backend /alerts endpoint on mount (see below).
const initialState: AppState = {
  alerts: [],
  activeCaseId: null,
  selectedNodeId: null,
  systemStatus: 'nominal',
  emergencyMode: false,
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_ALERT':
      return {
        ...state,
        alerts: [
          {
            ...action.payload,
            id: `local-${Date.now()}`,
            timestamp: new Date().toISOString(),
            read: false,
            local: true,
          },
          ...state.alerts,
        ],
      }
    case 'MARK_READ':
      return { ...state, alerts: state.alerts.map(a => a.id === action.payload ? { ...a, read: true } : a) }
    case 'MARK_ALL_READ':
      return { ...state, alerts: state.alerts.map(a => ({ ...a, read: true })) }
    case 'DISMISS_ALERT':
      return { ...state, alerts: state.alerts.filter(a => a.id !== action.payload) }
    case 'HYDRATE_ALERTS':
      // Backend alerts are the source of truth; local-only alerts (e.g. isolate
      // events from this session) are preserved on top.
      return {
        ...state,
        alerts: [
          ...state.alerts.filter(a => a.local),
          ...action.payload,
        ],
      }
    case 'SET_ACTIVE_CASE':
      return { ...state, activeCaseId: action.payload }
    case 'SET_SELECTED_NODE':
      return { ...state, selectedNodeId: action.payload }
    case 'SET_SYSTEM_STATUS':
      return { ...state, systemStatus: action.payload }
    case 'TOGGLE_EMERGENCY':
      return { ...state, emergencyMode: !state.emergencyMode }
    default:
      return state
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface AppContextValue {
  state: AppState
  addAlert: (alert: Omit<GlobalAlert, 'id' | 'timestamp' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  dismissAlert: (id: string) => void
  setActiveCase: (id: string | null) => void
  setSelectedNode: (id: string | null) => void
  setSystemStatus: (s: AppState['systemStatus']) => void
  toggleEmergency: () => void
  unreadCount: number
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const addAlert     = useCallback((a: Omit<GlobalAlert, 'id' | 'timestamp' | 'read' | 'local'>) => dispatch({ type: 'ADD_ALERT', payload: a }), [])
  const markRead     = useCallback((id: string) => dispatch({ type: 'MARK_READ', payload: id }), [])
  const markAllRead  = useCallback(() => dispatch({ type: 'MARK_ALL_READ' }), [])
  const dismissAlert = useCallback((id: string) => dispatch({ type: 'DISMISS_ALERT', payload: id }), [])
  const setActiveCase   = useCallback((id: string | null) => dispatch({ type: 'SET_ACTIVE_CASE', payload: id }), [])
  const setSelectedNode = useCallback((id: string | null) => dispatch({ type: 'SET_SELECTED_NODE', payload: id }), [])
  const setSystemStatus = useCallback((s: AppState['systemStatus']) => dispatch({ type: 'SET_SYSTEM_STATUS', payload: s }), [])
  const toggleEmergency = useCallback(() => dispatch({ type: 'TOGGLE_EMERGENCY' }), [])

  // Poll the backend for alerts while a session is active (auth state lives in
  // AuthContext, which wraps this provider, so gate on the persisted token).
  useEffect(() => {
    if (!getAccessToken()) return
    let cancelled = false

    async function poll() {
      try {
        const page = await alertsApi.list()
        if (!cancelled) dispatch({ type: 'HYDRATE_ALERTS', payload: page.items.map(backendAlertToGlobal) })
      } catch {
        /* transient — next poll retries */
      }
    }

    poll()
    const timer = setInterval(poll, 30_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  const unreadCount = state.alerts.filter(a => !a.read).length

  return (
    <AppContext.Provider value={{
      state, addAlert, markRead, markAllRead, dismissAlert,
      setActiveCase, setSelectedNode, setSystemStatus, toggleEmergency, unreadCount,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

export function useAlerts() {
  const { state, addAlert, markRead, markAllRead, dismissAlert, unreadCount } = useAppContext()
  return { alerts: state.alerts, addAlert, markRead, markAllRead, dismissAlert, unreadCount }
}

export function useActiveCase() {
  const { state, setActiveCase } = useAppContext()
  return { activeCaseId: state.activeCaseId, setActiveCase }
}
