import {
  createContext, useContext, useReducer, useCallback, type ReactNode,
} from 'react'

export interface AuthUser {
  id: string
  name: string
  operatorId: string
  clearanceLevel: number
  unit: string
  role: string
}

interface AuthState {
  isAuthenticated: boolean  // passed username/password
  hasPassed2FA: boolean     // completed OTP step
  user: AuthUser | null
}

type AuthAction =
  | { type: 'LOGIN_SUCCESS'; payload: AuthUser }
  | { type: 'MFA_SUCCESS' }
  | { type: 'LOGOUT' }

function reducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return { ...state, isAuthenticated: true, hasPassed2FA: false, user: action.payload }
    case 'MFA_SUCCESS':
      return { ...state, hasPassed2FA: true }
    case 'LOGOUT':
      return { isAuthenticated: false, hasPassed2FA: false, user: null }
    default:
      return state
  }
}

const initialState: AuthState = {
  isAuthenticated: false,
  hasPassed2FA: false,
  user: null,
}

// ── Mock user store ────────────────────────────────────────────────────────────
const MOCK_USERS: Record<string, AuthUser & { password: string }> = {
  'op.chen': {
    id: 'usr-001', password: 'sentinel',
    name: 'K. Chen', operatorId: 'OP-774A',
    clearanceLevel: 4, unit: 'Alpha-7', role: 'Senior Analyst',
  },
  'admin': {
    id: 'usr-002', password: 'admin',
    name: 'System Admin', operatorId: 'SYS-001',
    clearanceLevel: 5, unit: 'Command', role: 'Administrator',
  },
  'demo': {
    id: 'usr-003', password: 'demo',
    name: 'Demo Operator', operatorId: 'OP-219C',
    clearanceLevel: 3, unit: 'Beta-3', role: 'Analyst',
  },
}

// ── Context ────────────────────────────────────────────────────────────────────
interface AuthContextValue {
  state: AuthState
  login: (username: string, password: string) => Promise<boolean>
  verify2FA: (code: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 800))
    const record = MOCK_USERS[username.toLowerCase().trim()]
    if (record && record.password === password) {
      const { password: _pw, ...user } = record
      dispatch({ type: 'LOGIN_SUCCESS', payload: user })
      return true
    }
    return false
  }, [])

  const verify2FA = useCallback(async (code: string): Promise<boolean> => {
    await new Promise(r => setTimeout(r, 600))
    // Accept any 6-digit code for demo, or the hardcoded "473829"
    if (code.length === 6 && (/^\d{6}$/.test(code) || code === '473829')) {
      dispatch({ type: 'MFA_SUCCESS' })
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => dispatch({ type: 'LOGOUT' }), [])

  return (
    <AuthContext.Provider value={{ state, login, verify2FA, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
