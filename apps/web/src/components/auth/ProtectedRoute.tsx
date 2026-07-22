import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * ProtectedRoute — blocks unauthenticated access.
 * Redirects to /login if credentials not provided.
 * Redirects to /login/mfa if credentials valid but MFA not completed.
 */
export function ProtectedRoute() {
  const { state } = useAuth()
  if (!state.isAuthenticated) return <Navigate to="/login" replace />
  if (!state.hasPassed2FA)    return <Navigate to="/login/mfa" replace />
  return <Outlet />
}

/**
 * GuestOnlyRoute — blocks already-authenticated users from seeing login pages.
 * Redirects to /cases if fully authenticated.
 */
export function GuestOnlyRoute() {
  const { state } = useAuth()
  if (state.isAuthenticated && state.hasPassed2FA) return <Navigate to="/cases" replace />
  return <Outlet />
}
