import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock, Clock, ArrowLeft, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { ApiError } from '../services/client'
import { useAuth } from '../context/AuthContext'

// Decorative Background Pattern for MFA (matches Login)
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

export default function MFALogin() {
  const navigate = useNavigate()
  const { status, verifyMfa, pendingUsername } = useAuth()

  // Guard: only reachable with an in-progress MFA challenge.
  useEffect(() => {
    if (status !== 'mfa_pending') navigate('/login', { replace: true })
  }, [status, navigate])

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
    try {
      await verifyMfa(code)
      setSuccess(true)
      setTimeout(() => navigate('/cases', { replace: true }), 700)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed. Please try again.')
      setOtp(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    if (otp.every(d => d !== '')) handleVerify()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp])

  const otpInputClass = (filled: boolean) =>
    `w-12 h-14 rounded-md bg-bg-elevated border text-center text-xl font-mono font-bold focus:outline-none transition-all ${
      success ? 'border-severity-low bg-severity-low/10 text-severity-low'
      : filled ? 'border-border-strong text-text-primary' 
      : 'border-border-default text-text-primary focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.25)]'
    }`

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F1E33] to-bg-canvas flex flex-col items-center justify-center relative overflow-hidden">
      <BackgroundPattern />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 shadow-lg transition-colors duration-500 ${
          success ? 'bg-severity-low/20 border-severity-low/50' : 'bg-brand-500/10 border-brand-500/30'
        }`}>
          {success
            ? <CheckCircle className="w-6 h-6 text-severity-low" />
            : <Shield className="w-6 h-6 text-brand-500" />
          }
        </div>
        <h1 className="text-xl font-bold tracking-[0.15em] text-text-primary uppercase">Sentinel</h1>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px] mx-4 bg-bg-elevated border border-border-default rounded-xl p-8 shadow-2xl">
        {/* Step indicator */}
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="flex items-center gap-2 text-xs text-text-primary font-medium">
            <span className="w-5 h-5 rounded-full bg-severity-low text-white flex items-center justify-center">
              <CheckCircle className="w-3.5 h-3.5" />
            </span>
            Credentials
          </div>
          <div className="w-8 h-px bg-border-default" />
          <div className="flex items-center gap-2 text-xs text-text-primary font-medium">
            <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold">2</span>
            Verification
          </div>
        </div>

        <h2 className="text-2xl font-bold text-text-primary text-center mb-2">Two-Factor Authentication</h2>
        <p className="text-sm text-text-secondary text-center mb-8 leading-relaxed">
          {pendingUsername
            ? <>Welcome back, <span className="text-text-primary font-medium">{pendingUsername}</span>.<br />Enter the 6-digit code from your authenticator app.</>
            : 'Enter the 6-digit verification code from your authenticator app.'}
        </p>

        {/* OTP inputs — 3 + dash + 3 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[0, 1, 2].map(i => (
            <input
              key={i}
              ref={el => { refs.current[i] = el }}
              type="text"
              inputMode="numeric"
              autoFocus={i === 0}
              maxLength={1}
              value={otp[i]}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              disabled={loading || success}
              className={otpInputClass(!!otp[i])}
            />
          ))}
          <span className="text-text-tertiary font-medium text-lg mx-1">—</span>
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
        <div className="flex items-center justify-between mb-8">
          <span className={`flex items-center gap-1.5 text-sm font-mono font-medium ${seconds > 0 ? 'text-text-primary' : 'text-severity-critical'}`}>
            <Clock className="w-4 h-4 text-text-tertiary" />
            {mm}:{ss}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Code expires with challenge</span>
        </div>

        {/* Hint */}
        <div className="bg-severity-tint-info rounded-md p-4 mb-6">
          <p className="text-xs text-severity-info flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5" />
            Use the code from your registered authenticator app. Invalid attempts are audited.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 mb-6 bg-severity-tint-critical border border-severity-critical/30 rounded-md animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-severity-critical shrink-0 mt-0.5" />
            <p className="text-xs text-severity-critical leading-relaxed">{error}</p>
          </div>
        )}

        {/* Verify button */}
        <button
          onClick={handleVerify}
          disabled={loading || success}
          className={`w-full h-11 flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
            success 
              ? 'bg-severity-low text-white' 
              : 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm shadow-brand-500/20 hover:shadow-md'
          }`}
        >
          {loading ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
          ) : success ? (
            <><CheckCircle className="w-4 h-4" /> Authenticated — Redirecting...</>
          ) : (
            <>Verify Identity</>
          )}
        </button>

        {/* Back to login */}
        <button
          onClick={() => navigate('/login')}
          className="flex items-center justify-center gap-1.5 w-full mt-4 text-xs text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to Login
        </button>
      </div>

      {/* Footer badge */}
      <div className="relative z-10 mt-6 flex items-center justify-center gap-2 px-3 py-1.5 bg-bg-surface border border-border-subtle rounded-full shadow-sm">
        <Lock className="w-3.5 h-3.5 text-severity-low" />
        <span className="text-[10px] text-text-secondary">End-to-End Encrypted Session</span>
      </div>
    </div>
  )
}
