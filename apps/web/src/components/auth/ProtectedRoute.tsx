import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/**
 * ProtectedRoute — blocks unauthenticated access.
 * Redirects to /login unless the session is fully authenticated (MFA passed).
 * Returns null briefly while a persisted session is being restored.
 */
export function ProtectedRoute() {
  const { status, initializing } = useAuth()
  if (initializing) return null
  if (status !== 'authenticated') return <Navigate to="/login" replace />
  return <Outlet />
}

/**
 * GuestOnlyRoute — blocks already-authenticated users from seeing login pages.
 * Redirects to /cases if fully authenticated.
 */
export function GuestOnlyRoute() {
  const { status, initializing } = useAuth()
  if (initializing) return null
  if (status === 'authenticated') return <Navigate to="/cases" replace />
  return <Outlet />
}
