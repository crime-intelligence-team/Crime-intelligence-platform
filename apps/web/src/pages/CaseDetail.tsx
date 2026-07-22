import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, User, Shield, Send, X,
  TrendingUp, MessageSquare, Cpu, Database, Lock,
} from 'lucide-react'
import { SeverityBadge, StatusDot } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { mockCases } from '../data/cases'
import type { TimelineEvent, CommMessage } from '../types'

const eventIcon = {
  threat:  { icon: AlertTriangle, color: 'text-accent-amber  bg-accent-amber/10  border-accent-amber/20'  },
  account: { icon: User,          color: 'text-accent-blue   bg-accent-blue/10   border-accent-blue/20'   },
  analyst: { icon: Shield,        color: 'text-sentinel-300  bg-surface-hover    border-surface-border'   },
  system:  { icon: Cpu,           color: 'text-sentinel-400  bg-surface-raised   border-surface-border'   },
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const { icon: Icon, color } = eventIcon[event.type]
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="w-px flex-1 bg-surface-border mt-1" />
      </div>
      <div className="pb-5 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-medium text-accent-coral">{event.title}</span>
          <span className="font-mono text-[10px] text-sentinel-500 shrink-0">{event.timestamp}</span>
        </div>
        <p className="text-xs text-sentinel-300 leading-relaxed">{event.description}</p>
      </div>
    </div>
  )
}

function ChatBubble({ msg }: { msg: CommMessage }) {
  return (
    <div className={`flex gap-2.5 ${msg.side === 'right' ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold border ${msg.side === 'right' ? 'bg-accent-blue/20 border-accent-blue/30 text-accent-blue' : 'bg-surface-card border-surface-border text-sentinel-300'}`}>
        {msg.senderCode}
      </div>
      <div className={`max-w-[75%] ${msg.side === 'right' ? 'items-end' : 'items-start'} flex flex-col`}>
        <span className={`text-[10px] text-sentinel-500 mb-1 ${msg.side === 'right' ? 'text-right' : ''}`}>
          {msg.sender} · {msg.timestamp}
        </span>
        <div className={`px-3 py-2 rounded-lg text-xs text-sentinel-100 leading-relaxed ${msg.side === 'right' ? 'bg-accent-blue/10 border border-accent-blue/20' : 'bg-surface-card border border-surface-border'}`}>
          {msg.content}
        </div>
      </div>
    </div>
  )
}

export default function CaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const c = mockCases.find(x => x.id === id) ?? mockCases[0]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 gap-4">
        {/* Case header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <SeverityBadge severity={c.severity} />
              <span className="font-mono text-[11px] text-sentinel-400">ID: {c.caseId}</span>
              <span className="text-[11px] text-sentinel-500">• Active since: {c.activeSince}</span>
            </div>
            <h1 className="text-xl font-bold text-sentinel-50 leading-snug">{c.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <Button variant="danger" size="sm"><AlertTriangle className="w-3.5 h-3.5" /> Escalate Protocol</Button>
            <Button variant="secondary" size="sm"><Lock className="w-3.5 h-3.5" /> Isolate Node</Button>
            <Button variant="ghost" size="sm">Generate Report</Button>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5 border-b border-surface-border pb-3">
            <TrendingUp className="w-4 h-4 text-sentinel-400" />
            <h2 className="text-sm font-semibold text-sentinel-100">Investigation Timeline</h2>
          </div>
          <div className="space-y-0">
            {c.timeline.map(ev => <TimelineItem key={ev.id} event={ev} />)}
          </div>
        </div>

        {/* Comms log */}
        <div className="bg-surface-card border border-surface-border rounded-xl flex flex-col overflow-hidden" style={{ minHeight: 280 }}>
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-surface-border shrink-0">
            <MessageSquare className="w-4 h-4 text-sentinel-400" />
            <h2 className="text-sm font-semibold text-sentinel-100">Communication Log</h2>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {c.comms.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
          </div>
          <div className="px-4 py-3 border-t border-surface-border flex items-center gap-2 shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a note or /command..."
              className="flex-1 bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-xs text-sentinel-100 placeholder-sentinel-500 focus:outline-none focus:border-accent-blue/40 transition-colors"
            />
            <button
              onClick={() => setInput('')}
              className="p-2 rounded-lg bg-accent-blue text-white hover:bg-blue-500 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right panel — Related Entities */}
      <div className="w-[260px] shrink-0 border-l border-surface-border bg-surface-raised overflow-y-auto">
        <div className="px-4 py-4 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-sentinel-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sentinel-400" /> Related Entities
          </h2>
          <button onClick={() => navigate('/cases')} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-5">
          {/* Linked Nodes */}
          {c.linkedNodes.length > 0 && (
            <div>
              <p className="section-label mb-2">Linked Nodes</p>
              {c.linkedNodes.map(n => (
                <div key={n.id} className="flex items-center gap-2.5 py-2 border-b border-surface-border last:border-0">
                  {n.icon === 'database' ? <Database className="w-4 h-4 text-sentinel-400 shrink-0" /> : <Cpu className="w-4 h-4 text-sentinel-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-sentinel-100 truncate">{n.name}</p>
                    <p className="font-mono text-[10px] text-sentinel-500">{n.ip}</p>
                  </div>
                  <StatusDot status={n.status} pulse={n.status === 'critical'} />
                </div>
              ))}
            </div>
          )}

          {/* Personas */}
          {c.personas.length > 0 && (
            <div>
              <p className="section-label mb-2">Personas / Accounts</p>
              {c.personas.map(p => (
                <div key={p.id} className="flex items-center gap-2.5 py-2 border-b border-surface-border last:border-0">
                  <User className="w-4 h-4 text-sentinel-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[11px] text-sentinel-100 truncate">{p.name}</p>
                    <p className="text-[10px] text-severity-critical">{p.statusTag}</p>
                  </div>
                  {p.compromised && <Lock className="w-3.5 h-3.5 text-severity-critical shrink-0" />}
                </div>
              ))}
            </div>
          )}

          {/* Threat vectors */}
          {c.threatVectors.length > 0 && (
            <div>
              <p className="section-label mb-2">Threat Vectors</p>
              <div className="flex flex-wrap gap-1.5">
                {c.threatVectors.map(v => (
                  <span key={v} className="tag-pill">{v}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
