import { useState } from 'react'
import { TabBar } from '../components/ui/TabBar'
import { RiskScoreBadge } from '../components/ui/Badge'
import { Pagination } from '../components/ui/Pagination'
import { entityRegistry } from '../data/networkGraph'
import { Cpu, User, Building2, Network, CheckSquare, Square } from 'lucide-react'

const typeIconMap: Record<string, any> = {
  infrastructure: Cpu, persona: User, organization: Building2, gateway: Network, unknown: Cpu,
}

function TrafficBar({ value, max = 100, unit }: { value: number; max?: number; unit: string }) {
  const pct = Math.min(100, (value / (max || 1)) * 100)
  const barColor = value >= 30 ? '#f43f5e' : value >= 10 ? '#f59e0b' : '#3b82f6'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-surface-hover rounded-full overflow-hidden shrink-0">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <span className="font-mono text-[11px] text-sentinel-300">{value}{unit}</span>
    </div>
  )
}

export default function NodeRegistry() {
  const [activeTab, setActiveTab] = useState('Entity Registry')
  const [page, setPage] = useState(1)
  const [highRiskOnly, setHighRiskOnly] = useState(false)
  const [activeAnomalies, setActiveAnomalies] = useState(false)

  const filtered = entityRegistry.filter(n => {
    if (highRiskOnly && n.riskScore < 75) return false
    if (activeAnomalies && n.status === 'normal') return false
    return true
  })

  const COLS = ['ENTITY ID','TYPE','CONNECTIONS','TRAFFIC VOL (24H)','RISK SCORE','LAST SIGNAL']

  return (
    <div className="flex flex-col h-full">
      <TabBar tabs={['Interactive Graph','Entity Registry']} active={activeTab} onChange={setActiveTab}
        className="px-6 bg-surface-raised shrink-0" />

      <div className="flex-1 flex flex-col overflow-hidden p-0">
        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-surface-border flex items-center gap-4 shrink-0 bg-surface-raised/50">
          <label className="flex items-center gap-2 text-xs text-sentinel-300 cursor-pointer hover:text-sentinel-100 select-none">
            <button onClick={() => setHighRiskOnly(!highRiskOnly)} className="text-sentinel-400 hover:text-sentinel-200">
              {highRiskOnly ? <CheckSquare className="w-3.5 h-3.5 text-accent-blue" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            High Risk Only
          </label>
          <label className="flex items-center gap-2 text-xs text-sentinel-300 cursor-pointer hover:text-sentinel-100 select-none">
            <button onClick={() => setActiveAnomalies(!activeAnomalies)} className="text-sentinel-400 hover:text-sentinel-200">
              {activeAnomalies ? <CheckSquare className="w-3.5 h-3.5 text-accent-blue" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            Active Anomalies
          </label>
          <div className="ml-auto">
            <button className="px-3 py-1.5 text-xs text-sentinel-300 border border-surface-border rounded-lg hover:bg-surface-hover transition-colors">
              Filter
            </button>
          </div>
        </div>

        {/* Table header */}
        <div className="grid gap-0 border-b border-surface-border bg-surface-raised/30 shrink-0"
          style={{ gridTemplateColumns: '40px 180px 160px 140px 160px 120px 100px' }}>
          <div className="px-4 py-2.5" />
          {COLS.map(c => (
            <div key={c} className="px-3 py-2.5">
              <span className="section-label">{c}</span>
            </div>
          ))}
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(n => {
            const Icon = typeIconMap[n.type] ?? Cpu
            return (
              <div key={n.id}
                className="grid items-center border-b border-surface-border hover:bg-surface-hover transition-colors cursor-pointer group"
                style={{ gridTemplateColumns: '40px 180px 160px 140px 160px 120px 100px' }}>
                <div className="px-4 py-3 flex items-center">
                  <Square className="w-3.5 h-3.5 text-sentinel-600 group-hover:text-sentinel-400 transition-colors" />
                </div>
                <div className="px-3 py-3">
                  <span className="font-mono text-[11px] text-sentinel-100">{n.id}</span>
                </div>
                <div className="px-3 py-3 flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-sentinel-400 shrink-0" />
                  <span className="text-xs text-sentinel-200 capitalize">{n.type}</span>
                </div>
                <div className="px-3 py-3">
                  <span className="font-mono text-[11px] text-sentinel-200">{n.connections.toLocaleString()}</span>
                </div>
                <div className="px-3 py-3">
                  <TrafficBar value={n.trafficVol24h} max={50} unit={n.trafficUnit} />
                </div>
                <div className="px-3 py-3">
                  <RiskScoreBadge score={n.riskScore} />
                </div>
                <div className="px-3 py-3">
                  <span className="font-mono text-[11px] text-sentinel-400">{n.lastSignal}</span>
                </div>
              </div>
            )
          })}

          {/* Hidden records hint */}
          <div className="py-4 text-center">
            <span className="font-mono text-[11px] text-sentinel-500">[ {Math.max(0, 208 - filtered.length)} more records hidden ]</span>
          </div>
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-surface-border shrink-0 bg-surface-raised/50">
          <Pagination total={208} page={page} perPage={4} onPageChange={setPage} />
        </div>
      </div>
    </div>
  )
}
