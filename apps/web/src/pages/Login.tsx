import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, Lock, User, AlertTriangle, ChevronRight, Activity, ShieldAlert } from 'lucide-react'
import { ApiError } from '../services/client'
import { useAuth } from '../context/AuthContext'

// Decorative Background Pattern for left panel
function BackgroundPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      <svg className="absolute w-full h-full text-white" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="radar" width="120" height="120" patternUnits="userSpaceOnUse">
            <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="60" cy="60" r="25" fill="none" stroke="currentColor" strokeWidth="1" />
            <line x1="60" y1="0" x2="60" y2="120" stroke="currentColor" strokeWidth="1" />
            <line x1="0" y1="60" x2="120" y2="60" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#radar)" />
      </svg>
    </div>
  )
}

// Authorized-only notice above the form
function AccessWarning() {
  return (
    <div className="flex items-start gap-2 p-3 mb-6 bg-severity-tint-info border border-severity-info/20 rounded-md">
      <ShieldAlert className="w-4 h-4 text-severity-info shrink-0 mt-0.5" />
      <p className="text-[11px] text-text-secondary leading-relaxed">
        Authorized law-enforcement personnel only. All login attempts are logged and audited.
      </p>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [username, setUsername]         = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username || !password) { setError('Enter credentials to proceed.'); return }
    setLoading(true)
    setError('')
    try {
      const outcome = await login(username, password)
      if (outcome === 'mfa_required') {
        navigate('/login/mfa')
      } else {
        navigate('/cases', { replace: true })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to reach the API server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-bg-canvas text-text-primary">
      {/* Left Panel: Brand / Identity (40%) */}
      <div className="hidden lg:flex w-[40%] relative flex-col justify-between p-12 bg-gradient-to-b from-[#0F1E33] to-bg-canvas border-r border-border-default overflow-hidden">
        <BackgroundPattern />

        {/* Top Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center shadow-lg shadow-brand-500/10">
            <Shield className="w-6 h-6 text-brand-500" />
          </div>
          <span className="text-xl font-bold tracking-[0.15em] text-text-primary uppercase">Sentinel</span>
        </div>

        {/* Middle Headline */}
        <div className="relative z-10">
          <h1 className="text-[40px] font-bold text-text-primary leading-tight mb-4 tracking-tight">
            Command Center Access
          </h1>
          <p className="text-base text-text-secondary leading-relaxed max-w-sm">
            Secure authentication portal for the Sentinel Crime Intelligence Platform. Authorized personnel only.
          </p>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-severity-low animate-pulse" />
          <p className="text-xs tracking-widest text-text-tertiary uppercase">
            End-to-End Encrypted Session
          </p>
        </div>
      </div>

      {/* Right Panel: Auth Form (60%) */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-[420px] bg-bg-elevated border border-border-default rounded-xl p-8 shadow-2xl">
          {/* Mobile Logo & Header */}
          <div className="mb-8">
            <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mb-5 lg:hidden">
              <Shield className="w-5 h-5 text-brand-500" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-1">Sign in</h2>
            <p className="text-sm text-text-secondary">
              Use your operator ID and passphrase. <Link to="/login" className="text-brand-500 hover:text-brand-400 font-medium transition-colors">Contact your unit admin</Link> if locked out.
            </p>
          </div>

          <AccessWarning />

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Operator ID */}
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Operator ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="w-full h-9 pl-9 pr-4 bg-bg-surface-2 border border-border-default rounded-md text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-colors"
                />
              </div>
            </div>

            {/* Passphrase */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                  Passphrase
                </label>
                <Link to="#" className="text-xs text-brand-500 hover:text-brand-400 font-medium transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  className="w-full h-9 pl-9 pr-10 bg-bg-surface-2 border border-border-default rounded-md text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-severity-tint-critical border border-severity-critical/30 rounded-md">
                <AlertTriangle className="w-4 h-4 text-severity-critical shrink-0 mt-0.5" />
                <p className="text-xs text-severity-critical leading-relaxed">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 flex items-center justify-center gap-2 bg-brand-500 text-white hover:bg-brand-600 btn-primary-shimmer shadow-sm shadow-brand-500/20 hover:shadow-brand-500/30 hover:shadow-md ring-0 hover:ring-2 hover:ring-brand-500/30 ring-offset-0 ring-offset-bg-canvas rounded-md text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>
                  Verify Identity
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials Sub-panel */}
          <div className="mt-8 pt-6 border-t border-border-default">
            <div className="bg-severity-tint-info border border-severity-info/20 rounded-md p-4">
              <p className="text-xs font-semibold text-severity-info mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5" /> Demo Access
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { u: 'admin',   p: 'Password1!', role: 'Administrator' },
                  { u: 'analyst', p: 'Password1!', role: 'Analyst' },
                  { u: 'officer', p: 'Password1!', role: 'District Officer' },
                ].map(c => (
                  <button
                    key={c.u}
                    type="button"
                    onClick={() => { setUsername(c.u); setPassword(c.p) }}
                    className="py-2 px-2 rounded bg-bg-surface border border-border-default hover:border-border-strong text-text-secondary hover:text-text-primary transition-colors text-center flex flex-col items-center gap-0.5"
                  >
                    <span className="block font-mono text-xs">{c.u}</span>
                    <span className="text-[10px] text-text-tertiary">{c.role}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
