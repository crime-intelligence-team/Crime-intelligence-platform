import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock, Clock, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function MFALogin() {
  const navigate = useNavigate()
  const { state, verify2FA } = useAuth()

  // Guard: if user hasn't done step-1, send back to login
  useEffect(() => {
    if (!state.isAuthenticated) navigate('/login', { replace: true })
  }, [state.isAuthenticated, navigate])

  const [otp, setOtp]             = useState<string[]>(['', '', '', '', '', ''])
  const [seconds, setSeconds]     = useState(116)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer
  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => setSeconds(s => s - 1), 1000)
    return () => clearInterval(id)
  }, [seconds])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus()
  }

  function handleChange(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[i] = digit
    setOtp(next)
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }

  async function handleVerify() {
    const code = otp.join('')
    if (code.length < 6) { setError('Enter all 6 digits to verify.'); return }
    setLoading(true)
    setError('')
    const ok = await verify2FA(code)
    setLoading(false)
    if (ok) {
      setSuccess(true)
      setTimeout(() => navigate('/cases', { replace: true }), 900)
    } else {
      setError('Invalid code. Ensure you entered the correct 6-digit sequence.')
      setOtp(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    }
  }

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (otp.every(d => d !== '')) handleVerify()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp])

  const otpInputClass = (filled: boolean) =>
    `w-12 h-14 rounded-lg bg-surface-raised border text-center text-lg font-mono font-medium text-sentinel-50 focus:outline-none transition-colors ${
      success ? 'border-accent-emerald bg-accent-emerald/10 text-accent-emerald'
      : filled ? 'border-sentinel-300' : 'border-surface-border focus:border-sentinel-200 focus:bg-surface-overlay'
    }`

  return (
    <div className="min-h-screen bg-surface-base flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full bg-accent-blue/5 blur-3xl" />
      </div>
      {/* Subtle grid wallpaper */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none select-none"
        style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center mb-6">
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 shadow-lg transition-colors duration-500 ${
          success ? 'bg-accent-emerald/20 border-accent-emerald/50' : 'bg-surface-card border-surface-border'
        }`}>
          {success
            ? <CheckCircle className="w-6 h-6 text-accent-emerald" />
            : <Shield className="w-6 h-6 text-sentinel-200" />
          }
        </div>
        <h1 className="text-xl font-bold tracking-[0.3em] text-sentinel-50">SENTINEL</h1>
        <p className="text-[10px] tracking-[0.2em] text-sentinel-400 mt-0.5">INTELLIGENCE SYSTEM</p>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px] mx-4 bg-surface-card border border-surface-border rounded-2xl p-8 shadow-2xl">
        {/* Step indicator */}
        <div className="flex items-center gap-2 justify-center mb-5">
          <div className="flex items-center gap-1.5 text-[10px] text-sentinel-500">
            <span className="w-5 h-5 rounded-full bg-accent-emerald/20 border border-accent-emerald/50 text-accent-emerald flex items-center justify-center text-[9px] font-bold">✓</span>
            Credentials
          </div>
          <div className="w-6 h-px bg-surface-border" />
          <div className="flex items-center gap-1.5 text-[10px] text-sentinel-200 font-medium">
            <span className="w-5 h-5 rounded-full bg-accent-blue/20 border border-accent-blue/50 text-accent-blue flex items-center justify-center text-[9px] font-bold">2</span>
            Verification
          </div>
        </div>

        <h2 className="text-lg font-semibold text-sentinel-50 text-center mb-1.5">Two-Factor Authentication</h2>
        <p className="text-xs text-sentinel-400 text-center mb-7 leading-relaxed">
          {state.user
            ? <>Welcome back, <span className="text-sentinel-200 font-medium">{state.user.name}</span>.<br />Enter the 6-digit code from your secure device ending in <span className="text-sentinel-200 font-medium">**84</span>.</>
            : 'Enter the 6-digit verification code sent to your registered secure device.'
          }
        </p>

        {/* OTP inputs — 3 + dash + 3 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[0, 1, 2].map(i => (
            <input
              key={i}
              ref={el => { refs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={otp[i]}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              disabled={loading || success}
              className={otpInputClass(!!otp[i])}
            />
          ))}
          <span className="text-sentinel-400 font-medium text-lg mx-1">—</span>
          {[3, 4, 5].map(i => (
            <input
              key={i}
              ref={el => { refs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={otp[i]}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              disabled={loading || success}
              className={otpInputClass(!!otp[i])}
            />
          ))}
        </div>

        {/* Timer + Resend */}
        <div className="flex items-center justify-between mb-5">
          <span className={`flex items-center gap-1.5 text-sm font-mono font-medium ${seconds > 0 ? 'text-accent-amber' : 'text-severity-critical'}`}>
            <Clock className="w-3.5 h-3.5" />
            {mm}:{ss}
          </span>
          <button
            onClick={() => setSeconds(120)}
            disabled={seconds > 0}
            className="text-[11px] tracking-wider text-sentinel-400 hover:text-sentinel-200 uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Resend Code
          </button>
        </div>

        {/* Hint + Quick fill */}
        <div className="text-center mb-4 space-y-1.5">
          <p className="text-[10px] text-sentinel-500">
            Demo: Enter any 6-digit code (e.g. <span className="font-mono text-sentinel-300 font-semibold">473829</span> or <span className="font-mono text-sentinel-300 font-semibold">123456</span>)
          </p>
          <button
            type="button"
            onClick={() => setOtp(['4', '7', '3', '8', '2', '9'])}
            className="px-2.5 py-1 rounded bg-surface-raised border border-surface-border text-[10px] text-accent-blue font-mono hover:bg-surface-hover hover:border-accent-blue/40 transition-colors"
          >
            ⚡ Auto-Fill Code: 473829
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 mb-4 bg-severity-critical/10 border border-severity-critical/30 rounded-lg animate-fade-in">
            <AlertTriangle className="w-3.5 h-3.5 text-severity-critical shrink-0 mt-0.5" />
            <p className="text-xs text-severity-critical leading-relaxed">{error}</p>
          </div>
        )}

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={loading || success}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold tracking-[0.15em] transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
            success ? 'bg-accent-emerald text-white' : 'bg-sentinel-50 text-surface-base hover:bg-white'
          }`}
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-surface-base/30 border-t-surface-base rounded-full animate-spin" /> Verifying...</>
          ) : success ? (
            <><CheckCircle className="w-4 h-4" /> Authenticated — Redirecting...</>
          ) : (
            <><Lock className="w-4 h-4" /> VERIFY IDENTITY</>
          )}
        </button>

        {/* Back to login */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center justify-center gap-1.5 w-full mt-4 text-xs text-sentinel-400 hover:text-sentinel-200 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Return to Login
        </button>
      </div>

      {/* Footer badge */}
      <div className="relative z-10 mt-6 flex items-center gap-2 px-4 py-2 bg-surface-card/60 border border-surface-border rounded-full">
        <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
        <span className="text-[10px] tracking-[0.15em] text-sentinel-400 uppercase">End-to-End Encrypted Session</span>
      </div>
    </div>
  )
}
