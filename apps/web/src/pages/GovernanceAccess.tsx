import { useState } from 'react'
import { Plus, X, ShieldCheck, Check, Ban, Undo2, Loader2, FileClock } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { accessExceptionsApi } from '../services/endpoints'
import { ApiError } from '../services/client'
import { Button } from '../components/ui/Button'
import { StepUpModal } from '../components/ui/StepUpModal'
import { SkeletonRow } from '../components/ui/Skeletons'
import type { AccessExceptionRequestResponse } from '@cip/shared-types'

const statusMeta: Record<string, { label: string; cls: string }> = {
  pending:  { label: 'PENDING',  cls: 'bg-accent-amber/15 border-accent-amber/40 text-accent-amber' },
  approved: { label: 'APPROVED', cls: 'bg-severity-tint-low border-severity-low/40 text-severity-low' },
  denied:   { label: 'DENIED',   cls: 'bg-severity-tint-critical border-severity-critical/40 text-severity-critical' },
  revoked:  { label: 'REVOKED',  cls: 'bg-surface-hover border-surface-border text-sentinel-400' },
}

function StatusBadge({ r }: { r: AccessExceptionRequestResponse }) {
  const m = statusMeta[r.status] ?? statusMeta.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] font-bold tracking-wider ${m.cls}`}>
      {r.effective && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {m.label}
    </span>
  )
}

// ── Create request modal ──────────────────────────────────────────────────────
function CreateRequestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [caseRef, setCaseRef] = useState('')
  const [reason, setReason] = useState('')
  const [hours, setHours] = useState('24')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-sentinel-100 placeholder-sentinel-500 focus:outline-none focus:border-accent-blue/40 transition-colors'
  const labelCls = 'block text-[11px] uppercase font-semibold tracking-wider text-sentinel-500 mb-1.5'

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      await accessExceptionsApi.create({ case_reference: caseRef, operational_reason: reason, requested_duration_hours: hours })
      onCreated()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Request failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[440px] bg-surface-raised border border-surface-border rounded-xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-sentinel-100 flex items-center gap-2">
            <FileClock className="w-4 h-4 text-accent-blue" /> Request Access Exception
          </h2>
          <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Case Reference</label>
            <input value={caseRef} onChange={e => setCaseRef(e.target.value)} placeholder="e.g. CASE-2026-0001" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Operational Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Why this exception is operationally necessary"
              className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Requested Duration (hours)</label>
            <input type="number" min={1} max={8760} value={hours} onChange={e => setHours(e.target.value)} className={inputCls} />
            <p className="text-[10px] text-sentinel-500 mt-1">1–8760 hours; approval is time-boxed.</p>
          </div>
          {error && <p className="text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting || !caseRef.trim() || !reason.trim()}>
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit Request'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GovernanceAccess() {
  const { hasPermission } = useAuth()
  const canApprove = hasPermission('exception:approve')

  const { data: requests, loading, error, refetch } = useApi(() => accessExceptionsApi.list())
  const all = requests ?? []

  const [showCreate, setShowCreate] = useState(false)
  const [approveTarget, setApproveTarget] = useState<AccessExceptionRequestResponse | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const pending = all.filter(r => r.status === 'pending').length
  const effective = all.filter(r => r.effective).length
  const denied = all.filter(r => r.status === 'denied').length

  async function runTransition(id: string, fn: (id: string) => Promise<unknown>) {
    setBusyId(id)
    setActionError(null)
    try {
      await fn(id)
      refetch()
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="relative h-full overflow-y-auto bg-surface-base">
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-sentinel-50">Access Exceptions</h1>
            <p className="text-xs text-sentinel-400 mt-0.5">Temporary access requests and approvals for time-boxed case access</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-xs font-semibold hover:bg-accent-blue/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Request Exception
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Requests', value: all.length, cls: 'text-sentinel-50' },
            { label: 'Pending Review', value: pending, cls: 'text-accent-amber' },
            { label: 'Currently Effective', value: effective, cls: 'text-severity-low' },
            { label: 'Denied', value: denied, cls: 'text-severity-critical' },
          ].map(s => (
            <div key={s.label} className="bg-surface-card border border-surface-border rounded-xl p-4">
              <p className="text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase mb-2">{s.label}</p>
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {actionError && (
          <div className="mb-4 text-xs text-severity-critical bg-severity-critical/10 border border-severity-critical/30 rounded-lg px-4 py-2.5">{actionError}</div>
        )}

        {/* Table */}
        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <div className="grid px-4 py-2.5 border-b border-surface-border text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase"
            style={{ gridTemplateColumns: '120px 1fr 90px 120px 100px 140px 190px' }}>
            <span>Case Ref</span><span>Reason</span><span>Duration</span><span>Requested By</span><span>Status</span><span>Expires</span><span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-surface-border">
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            {!loading && error && (
              <div className="px-4 py-10 text-center text-xs text-severity-critical">
                Failed to load requests: {error}
              </div>
            )}
            {!loading && !error && all.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-sentinel-500">No access exception requests yet.</div>
            )}
            {all.map(r => (
              <div key={r.id} className="grid px-4 py-3 items-center hover:bg-surface-hover/50 transition-colors"
                style={{ gridTemplateColumns: '120px 1fr 90px 120px 100px 140px 190px' }}>
                <span className="font-mono text-[11px] text-sentinel-100">{r.case_reference}</span>
                <span className="text-xs text-sentinel-300 truncate pr-2" title={r.operational_reason}>{r.operational_reason}</span>
                <span className="font-mono text-[11px] text-sentinel-300">{r.requested_duration_hours}h</span>
                <span className="font-mono text-[10px] text-sentinel-500">{r.requested_by_id.slice(0, 8)}</span>
                <StatusBadge r={r} />
                <span className="font-mono text-[10px] text-sentinel-400">
                  {r.expires_at ? new Date(r.expires_at).toLocaleString() : '—'}
                </span>
                <div className="flex items-center justify-end gap-1">
                  {canApprove && r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => setApproveTarget(r)}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-semibold bg-severity-tint-low text-severity-low border border-severity-low/30 hover:bg-severity-low/20 transition-colors disabled:opacity-50"
                      >
                        {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                      </button>
                      <button
                        onClick={() => runTransition(r.id, id => accessExceptionsApi.deny(id))}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-semibold bg-severity-tint-critical text-severity-critical border border-severity-critical/30 hover:bg-severity-critical/20 transition-colors disabled:opacity-50"
                      >
                        <Ban className="w-3 h-3" /> Deny
                      </button>
                    </>
                  )}
                  {canApprove && r.status === 'approved' && (
                    <button
                      onClick={() => runTransition(r.id, id => accessExceptionsApi.revoke(id))}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-semibold text-sentinel-300 border border-surface-border hover:bg-surface-hover transition-colors disabled:opacity-50"
                    >
                      <Undo2 className="w-3 h-3" /> Revoke
                    </button>
                  )}
                  {(!canApprove || (r.status !== 'pending' && r.status !== 'approved')) && (
                    <span className="text-[10px] text-sentinel-600">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!canApprove && (
          <p className="mt-4 text-[11px] text-sentinel-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> You can submit and track requests; approval requires exception:approve clearance.
          </p>
        )}
      </div>

      {showCreate && <CreateRequestModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch() }} />}
      {approveTarget && (
        <StepUpModal
          title="Approve Access Exception"
          subtitle={`Granting temporary access for ${approveTarget.case_reference}. Requires elevated authorization.`}
          onClose={() => setApproveTarget(null)}
          onSuccess={async () => {
            await accessExceptionsApi.approve(approveTarget.id)
            refetch()
          }}
        />
      )}
    </div>
  )
}
