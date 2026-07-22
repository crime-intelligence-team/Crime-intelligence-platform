import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react'

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
}

interface AppState {
  alerts: GlobalAlert[]
  activeCaseId: string | null
  selectedNodeId: string | null
  systemStatus: 'nominal' | 'degraded' | 'critical'
  emergencyMode: boolean
}

type Action =
  | { type: 'ADD_ALERT'; payload: Omit<GlobalAlert, 'id' | 'timestamp' | 'read'> }
  | { type: 'MARK_READ'; payload: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'DISMISS_ALERT'; payload: string }
  | { type: 'SET_ACTIVE_CASE'; payload: string | null }
  | { type: 'SET_SELECTED_NODE'; payload: string | null }
  | { type: 'SET_SYSTEM_STATUS'; payload: AppState['systemStatus'] }
  | { type: 'TOGGLE_EMERGENCY' }

// ─── Initial state with 3 seed alerts ─────────────────────────────────────────
const initialState: AppState = {
  alerts: [
    {
      id: 'alert-1',
      severity: 'critical',
      title: 'Anomalous Exfiltration — BLR-SRV-01',
      description: 'Traffic spike +340% above baseline. Isolate node immediately.',
      timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      read: false,
      caseId: '1',
      nodeId: 'BLR-SRV-01',
    },
    {
      id: 'alert-2',
      severity: 'elevated',
      title: 'Grid Frequency Deviation — NRT-04',
      description: 'Substation NRT-04 outside safe thresholds. Field team dispatched.',
      timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
      read: false,
      caseId: '2',
    },
    {
      id: 'alert-3',
      severity: 'low',
      title: 'Clearance Renewal Completed — HUB-OP-22',
      description: 'Auto-renewal processed successfully.',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      read: true,
    },
  ],
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
            id: `alert-${Date.now()}`,
            timestamp: new Date().toISOString(),
            read: false,
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

  const addAlert     = useCallback((a: Omit<GlobalAlert, 'id' | 'timestamp' | 'read'>) => dispatch({ type: 'ADD_ALERT', payload: a }), [])
  const markRead     = useCallback((id: string) => dispatch({ type: 'MARK_READ', payload: id }), [])
  const markAllRead  = useCallback(() => dispatch({ type: 'MARK_ALL_READ' }), [])
  const dismissAlert = useCallback((id: string) => dispatch({ type: 'DISMISS_ALERT', payload: id }), [])
  const setActiveCase   = useCallback((id: string | null) => dispatch({ type: 'SET_ACTIVE_CASE', payload: id }), [])
  const setSelectedNode = useCallback((id: string | null) => dispatch({ type: 'SET_SELECTED_NODE', payload: id }), [])
  const setSystemStatus = useCallback((s: AppState['systemStatus']) => dispatch({ type: 'SET_SYSTEM_STATUS', payload: s }), [])
  const toggleEmergency = useCallback(() => dispatch({ type: 'TOGGLE_EMERGENCY' }), [])

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
