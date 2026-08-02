import { useState } from 'react'
import { Lock, X, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { authApi } from '../../services/endpoints'
import { ApiError, setStepUpToken } from '../../services/client'

const inputCls = 'w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-sentinel-100 placeholder-sentinel-500 focus:outline-none focus:border-accent-blue/40 transition-colors'

/**
 * Re-authentication modal used by any elevated action (report export,
 * access-exception approval). Prompts for password, then a TOTP code when
 * the officer has MFA enrolled; on success stores the short-lived step-up
 * token and runs `onSuccess`.
 */
export function StepUpModal({ title, subtitle, onClose, onSuccess }: {
  title: string
  subtitle?: string
  onClose: () => void
  onSuccess: () => Promise<void>
}) {
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showOtp, setShowOtp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await authApi.stepUp({ password, otp_code: showOtp ? otp : undefined })
      setStepUpToken(res.step_up_token)
      await onSuccess()
      onClose()
    } catch (e) {
      if (e instanceof ApiError && e.code === 'invalid_otp' && !showOtp) {
        setShowOtp(true)
        setError('Multi-factor authentication is required. Enter your one-time code.')
      } else {
        setError(e instanceof ApiError ? e.message : 'Step-up failed')
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[360px] bg-surface-raised border border-surface-border rounded-xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-sentinel-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-accent-coral" /> {title}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-sentinel-400 mb-4 leading-relaxed">
          {subtitle ?? 'This action requires elevated clearance. Re-authenticate to continue.'}
        </p>
        <div className="space-y-3">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={inputCls} />
          {showOtp && <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="One-time code" className={inputCls} />}
          {error && <p className="text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-md px-3 py-2">{error}</p>}
          <Button variant="primary" size="md" className="w-full" onClick={handleSubmit} disabled={submitting || !password}>
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Authorize'}
          </Button>
        </div>
      </div>
    </div>
  )
}
