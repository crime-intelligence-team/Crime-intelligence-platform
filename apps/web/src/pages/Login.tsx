import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Lock, User, AlertTriangle, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// ── Wallpaper grid of faded UI cards ─────────────────────────────────────────
function WallpaperGrid() {
  const cards = Array.from({ length: 12 })
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <div className="grid grid-cols-4 gap-3 p-4 opacity-[0.06] scale-110 rotate-[-4deg] origin-center" style={{ minHeight: '120%', marginTop: '-10%' }}>
        {cards.map((_, i) => (
          <div key={i} className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-surface-hover" />
              <div className="h-2 bg-surface-hover rounded w-20" />
              <div className="ml-auto h-2 bg-severity-critical/50 rounded w-12" />
            </div>
            {[80, 60, 40, 70, 50].map((w, j) => (
              <div key={j} className="h-1.5 bg-surface-hover rounded" style={{ width: `${w}%` }} />
            ))}
            <div className="mt-3 h-16 bg-surface-hover/50 rounded-lg" />
            <div className="flex gap-2 mt-2">
              <div className="h-6 bg-severity-critical/30 rounded w-16" />
              <div className="h-6 bg-surface-hover rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Clearance level display ───────────────────────────────────────────────────
const CLEARANCE_LABELS = ['', 'Basic', 'Restricted', 'Operational', 'Strategic', 'Command']

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [username, setUsername]         = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [clearanceLevel, setClearance]  = useState(3)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username || !password) { setError('Enter credentials to proceed.'); return }
    setLoading(true)
    setError('')
    const ok = await login(username, password)
    setLoading(false)
    if (ok) {
      navigate('/login/mfa')
    } else {
      setError('Invalid credentials. Verify your Operator ID and passphrase.')
    }
  }

  return (
    <div className="relative min-h-screen bg-surface-base flex items-center justify-center overflow-hidden">
      <WallpaperGrid />

      {/* Radial gradient spotlight */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-[400px] mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center mb-4 shadow-lg shadow-accent-blue/10">
            <Shield className="w-7 h-7 text-accent-blue" />
          </div>
          <h1 className="text-2xl font-bold tracking-[0.15em] text-sentinel-50 uppercase">Sentinel</h1>
          <p className="text-[10px] tracking-[0.3em] text-sentinel-400 uppercase mt-1">Intelligence System</p>
        </div>

        {/* Card */}
        <div className="bg-surface-raised/80 backdrop-blur-xl border border-surface-border rounded-2xl p-8 shadow-2xl shadow-black/40">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-sentinel-50">Secure Access</h2>
            <p className="text-xs text-sentinel-400 mt-1">Enter your operator credentials to authenticate</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Operator ID */}
            <div>
              <label className="block text-[10px] font-semibold tracking-widest text-sentinel-400 uppercase mb-1.5">
                Operator ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sentinel-500" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="op.chen"
                  autoComplete="username"
                  className="w-full pl-9 pr-4 py-2.5 bg-surface-card border border-surface-border rounded-lg text-sm text-sentinel-100 placeholder-sentinel-600 focus:outline-none focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/20 transition-colors"
                />
              </div>
            </div>

            {/* Passphrase */}
            <div>
              <label className="block text-[10px] font-semibold tracking-widest text-sentinel-400 uppercase mb-1.5">
                Passphrase
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sentinel-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  className="w-full pl-9 pr-10 py-2.5 bg-surface-card border border-surface-border rounded-lg text-sm text-sentinel-100 placeholder-sentinel-600 focus:outline-none focus:border-accent-blue/60 focus:ring-1 focus:ring-accent-blue/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sentinel-500 hover:text-sentinel-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Clearance level selector */}
            <div>
              <label className="block text-[10px] font-semibold tracking-widest text-sentinel-400 uppercase mb-1.5">
                Clearance Level
              </label>
              <div className="flex gap-1.5">
                {[3, 4, 5].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setClearance(lvl)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      clearanceLevel === lvl
                        ? 'bg-accent-blue/15 border-accent-blue/50 text-accent-blue'
                        : 'bg-surface-card border-surface-border text-sentinel-400 hover:border-surface-hover'
                    }`}
                  >
                    CL-{lvl}
                    <span className="block text-[9px] font-normal mt-0.5 text-current opacity-70">
                      {CLEARANCE_LABELS[lvl]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-severity-critical/10 border border-severity-critical/30 rounded-lg animate-fade-in">
                <AlertTriangle className="w-3.5 h-3.5 text-severity-critical shrink-0 mt-0.5" />
                <p className="text-xs text-severity-critical leading-relaxed">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-sentinel-50 text-surface-base rounded-lg text-sm font-semibold tracking-wider uppercase hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-surface-base/30 border-t-surface-base rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Verify Identity
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-5 pt-4 border-t border-surface-border">
            <p className="text-[10px] text-sentinel-600 text-center mb-2 uppercase tracking-wider">Demo Credentials</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { u: 'demo', p: 'demo', cl: 'CL-3' },
                { u: 'op.chen', p: 'sentinel', cl: 'CL-4' },
                { u: 'admin', p: 'admin', cl: 'CL-5' },
              ].map(c => (
                <button
                  key={c.u}
                  type="button"
                  onClick={() => { setUsername(c.u); setPassword(c.p) }}
                  className="py-1.5 px-2 rounded-lg bg-surface-card border border-surface-border text-[10px] text-sentinel-400 hover:text-sentinel-200 hover:border-surface-hover transition-colors text-center"
                >
                  <span className="block font-mono">{c.u}</span>
                  <span className="text-sentinel-600">{c.cl}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom badge */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
          <span className="text-[10px] tracking-widest text-sentinel-600 uppercase">End-to-End Encrypted Session</span>
        </div>
      </div>
    </div>
  )
}
