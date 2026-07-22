import { useState } from 'react'
import { Activity, AlertTriangle, CheckCircle, Shield, Download, RefreshCw } from 'lucide-react'
import { ProgressBar } from '../components/ui/ProgressBar'
import { SkeletonTable } from '../components/ui/Skeletons'
import { useApi } from '../hooks/useApi'
import { governanceApi } from '../services/api'

// ── Node integrity row ────────────────────────────────────────────────────────
const statusConfig = {
  healthy:    { label: 'Healthy',    icon: CheckCircle,   color: 'text-accent-emerald', bg: 'bg-accent-emerald/10 border-accent-emerald/30' },
  degraded:   { label: 'Degraded',   icon: AlertTriangle, color: 'text-accent-amber',   bg: 'bg-accent-amber/10 border-accent-amber/30'     },
  compromised:{ label: 'Compromised',icon: AlertTriangle, color: 'text-severity-critical', bg: 'bg-severity-critical/10 border-severity-critical/30' },
  offline:    { label: 'Offline',    icon: Activity,      color: 'text-sentinel-400',   bg: 'bg-surface-hover border-surface-border'         },
}

const SCAN_PHASES = ['Initializing', 'Scanning Nodes', 'Verifying Checksums', 'Analyzing Anomalies', 'Complete']

export default function GovernanceIntegrity() {
  const [scanProgress, setScanProgress] = useState(0)
  const [scanning, setScanning]         = useState(false)
  const [scanPhase, setScanPhase]       = useState('')
  const { data: nodes, loading, refetch } = useApi(governanceApi.nodeIntegrity)

  function runScan() {
    if (scanning) return
    setScanning(true)
    setScanProgress(0)
    let step = 0
    const id = setInterval(() => {
      step += 1
      setScanProgress(Math.min(step * 5, 100))
      setScanPhase(SCAN_PHASES[Math.min(Math.floor(step / 4), 4)])
      if (step >= 20) { clearInterval(id); setScanning(false); refetch() }
    }, 200)
  }

  const healthyCount     = nodes?.filter(n => n.status === 'healthy').length     ?? 0
  const degradedCount    = nodes?.filter(n => n.status === 'degraded').length    ?? 0
  const compromisedCount = nodes?.filter(n => n.status === 'compromised').length ?? 0
  const offlineCount     = nodes?.filter(n => n.status === 'offline').length     ?? 0
  const totalCount       = nodes?.length ?? 1
  const complianceScore  = nodes ? Math.round((healthyCount / totalCount) * 100) : 0

  return (
    <div className="h-full overflow-y-auto bg-surface-base">
      <div className="max-w-[1200px] mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-sentinel-50">Integrity Monitoring</h1>
            <p className="text-xs text-sentinel-400 mt-0.5">Real-time node health, checksum verification, and system compliance tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={runScan} disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-accent-blue/10 border border-accent-blue/30 text-accent-blue rounded-lg text-xs font-semibold hover:bg-accent-blue/20 transition-colors disabled:opacity-60">
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? `${scanPhase} (${scanProgress}%)` : 'Run Integrity Scan'}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-surface-card border border-surface-border text-sentinel-300 rounded-lg text-xs font-semibold hover:bg-surface-hover transition-colors">
              <Download className="w-3.5 h-3.5" /> Export Report
            </button>
          </div>
        </div>

        {/* Scan progress */}
        {scanning && (
          <div className="mb-6 bg-surface-card border border-accent-blue/20 rounded-xl p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-accent-blue">{scanPhase}...</span>
              <span className="font-mono text-xs text-accent-blue">{scanProgress}%</span>
            </div>
            <ProgressBar value={scanProgress} color="blue" showValue={false} />
          </div>
        )}

        {/* Compliance gauge + stats */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {/* SVG Compliance ring */}
          <div className="col-span-1 bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col items-center justify-center">
            <div className="relative w-24 h-24 mb-3">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="10" />
                <circle cx="50" cy="50" r="40" fill="none"
                  stroke={complianceScore >= 80 ? '#22c55e' : complianceScore >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - complianceScore / 100)}`}
                  strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-sentinel-50">{complianceScore}</span>
                <span className="text-[9px] text-sentinel-400 uppercase tracking-wider">%</span>
              </div>
            </div>
            <p className="text-[10px] font-semibold tracking-widest text-sentinel-400 uppercase text-center">Compliance Score</p>
          </div>

          {/* Stat cards */}
          {[
            { label: 'Healthy Nodes',     value: healthyCount,     color: 'text-accent-emerald' },
            { label: 'Degraded',          value: degradedCount,    color: 'text-accent-amber'   },
            { label: 'Compromised',       value: compromisedCount, color: 'text-severity-critical' },
            { label: 'Offline',           value: offlineCount,     color: 'text-sentinel-400'   },
          ].map(s => (
            <div key={s.label} className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col justify-between">
              <p className="text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase">{s.label}</p>
              {loading ? <div className="h-8 bg-surface-hover animate-pulse rounded w-16 mt-2" /> : (
                <p className={`text-3xl font-bold mt-2 ${s.color}`}>{s.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Node integrity table */}
        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-sentinel-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-sentinel-400" /> Node Integrity Matrix
            </h2>
            <span className="text-[10px] text-sentinel-500">Last scan: {new Date().toLocaleTimeString()}</span>
          </div>

          {/* Table header */}
          <div className="grid px-5 py-2 border-b border-surface-border text-[10px] font-semibold tracking-widest text-sentinel-500 uppercase"
            style={{ gridTemplateColumns: '140px 1fr 100px 110px 120px 130px' }}>
            <span>Node ID</span><span>Description</span><span>Type</span><span>Status</span><span>Integrity Score</span><span>Last Verified</span>
          </div>

          {loading ? <SkeletonTable rows={8} /> : (
            nodes?.map(node => {
              const sc = statusConfig[node.status as keyof typeof statusConfig] ?? statusConfig.offline
              const StatusIcon = sc.icon
              return (
                <div key={node.nodeId}
                  className="grid px-5 py-3.5 border-b border-surface-border hover:bg-surface-hover transition-colors items-center"
                  style={{ gridTemplateColumns: '140px 1fr 100px 110px 120px 130px' }}>
                  <span className="font-mono text-xs text-sentinel-100">{node.nodeId}</span>
                  <span className="text-xs text-sentinel-300 truncate pr-4">{node.description}</span>
                  <span className="text-[11px] text-sentinel-400 capitalize">{node.type}</span>
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border w-fit text-[10px] font-semibold ${sc.bg} ${sc.color}`}>
                    <StatusIcon className="w-3 h-3" /> {sc.label}
                  </div>
                  <div className="flex items-center gap-2 pr-4">
                    <div className="flex-1 h-1.5 rounded-full bg-surface-hover overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        node.integrityScore >= 80 ? 'bg-accent-emerald' : node.integrityScore >= 60 ? 'bg-accent-amber' : 'bg-severity-critical'
                      }`} style={{ width: `${node.integrityScore}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-sentinel-300 w-8 text-right">{node.integrityScore}%</span>
                  </div>
                  <span className="font-mono text-[10px] text-sentinel-500">{node.lastVerified}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
