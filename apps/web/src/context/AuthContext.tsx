import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react'

import type { CurrentUserResponse } from '@cip/shared-types'
import { authApi } from '../services/endpoints'
import {
  getAccessToken, setAccessToken, setOnUnauthorized, setStepUpToken,
} from '../services/client'

export type AuthStatus = 'unauthenticated' | 'mfa_pending' | 'authenticated'

/** The authenticated operator (shape from GET /auth/me). */
export type AuthUser = CurrentUserResponse

export type LoginOutcome = 'mfa_required' | 'authenticated'

interface AuthContextValue {
  /** true while a persisted session is being restored on mount. */
  initializing: boolean
  status: AuthStatus
  user: AuthUser | null
  /** username/official id captured at step 1, shown on the MFA greeting. */
  pendingUsername: string | null
  login: (usernameOrOfficialId: string, password: string) => Promise<LoginOutcome>
  verifyMfa: (otpCode: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true)
  const [status, setStatus] = useState<AuthStatus>('unauthenticated')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [pendingUsername, setPendingUsername] = useState<string | null>(null)
  const mfaChallengeTokenRef = useRef<string | null>(null)

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setStepUpToken(null)
    mfaChallengeTokenRef.current = null
    setUser(null)
    setPendingUsername(null)
    setStatus('unauthenticated')
  }, [])

  const applyUser = useCallback((u: AuthUser) => {
    setUser(u)
    setPendingUsername(null)
    setStatus('authenticated')
  }, [])

  const refreshUser = useCallback(async () => {
    applyUser(await authApi.me())
  }, [applyUser])

  // Restore a persisted session on mount; any 401 clears the stale token.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!getAccessToken()) {
        if (!cancelled) setInitializing(false)
        return
      }
      try {
        const me = await authApi.me()
        if (!cancelled) applyUser(me)
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applyUser, clearSession])

  // Any later 401 (expired session mid-use) force-logs-out; ProtectedRoute
  // reacts to the status change and redirects to /login.
  useEffect(() => {
    setOnUnauthorized(() => {
      if (status === 'authenticated') clearSession()
    })
    return () => setOnUnauthorized(null)
  }, [status, clearSession])

  const login = useCallback(
    async (usernameOrOfficialId: string, password: string): Promise<LoginOutcome> => {
      const res = await authApi.login({ username_or_official_id: usernameOrOfficialId, password })
      if (res.mfa_required) {
        mfaChallengeTokenRef.current = res.mfa_challenge_token
        setPendingUsername(usernameOrOfficialId)
        setStatus('mfa_pending')
        return 'mfa_required'
      }
      setAccessToken(res.access_token)
      applyUser(await authApi.me())
      return 'authenticated'
    },
    [applyUser],
  )

  const verifyMfa = useCallback(
    async (otpCode: string) => {
      const token = mfaChallengeTokenRef.current
      if (!token) throw new Error('No MFA challenge is in progress')
      const res = await authApi.verifyMfa({ mfa_challenge_token: token, otp_code: otpCode })
      mfaChallengeTokenRef.current = null
      setAccessToken(res.access_token)
      applyUser(await authApi.me())
    },
    [applyUser],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* stateless logout: discard tokens locally regardless of network result */
    }
    clearSession()
  }, [clearSession])

  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  )
  const hasRole = useCallback((...roles: string[]) => !!user && roles.includes(user.role), [user])

  return (
    <AuthContext.Provider
      value={{
        initializing,
        status,
        user,
        pendingUsername,
        login,
        verifyMfa,
        logout,
        refreshUser,
        hasPermission,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
