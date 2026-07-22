import { useState, useCallback } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import cytoscape from 'cytoscape'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { X, ZoomIn, ZoomOut, Move, Grid3x3, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react'
import { TabBar } from '../components/ui/TabBar'
import { StatusDot } from '../components/ui/Badge'
import { ErrorBoundary } from '../components/ui/ErrorBoundary'
import { SkeletonGraph } from '../components/ui/Skeletons'
import { useApi } from '../hooks/useApi'
import { networkApi } from '../services/api'
import { useAppContext } from '../context/AppContext'
import { cytoscapeEdges } from '../data/networkGraph'
import type { CytoscapeNodeData, ActiveConnection } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CY_STYLESHEET: any[] = [
  {
    selector: 'node',
    style: {
      'background-color': '#1a2332',
      'border-color': '#64748b',
      'border-width': 1.5,
      'label': 'data(label)',
      'font-family': 'JetBrains Mono, monospace',
      'font-size': '10px',
      'color': '#64748b',
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'width': 48,
      'height': 48,
      'shape': 'roundrectangle',
    } as any,
  },
  {
    selector: 'node[status = "critical"]',
    style: {
      'background-color': '#ef4444',
      'border-color': '#ef4444',
      'color': '#f1f5f9',
    } as any,
  },
  {
    selector: 'node[status = "warning"]',
    style: {
      'border-color': '#f59e0b',
      'color': '#f59e0b',
    } as any,
  },
  {
    selector: 'node:selected',
    style: {
      'border-color': '#f1f5f9',
      'border-width': 2.5,
    } as any,
  },
  {
    selector: 'edge',
    style: {
      'width': 1.5,
      'line-color': '#2d3a4d',
      'target-arrow-color': '#2d3a4d',
      'curve-style': 'bezier',
    } as any,
  },
  {
    selector: 'edge[type = "anomaly"]',
    style: {
      'line-color': '#ef4444',
      'target-arrow-color': '#ef4444',
      'width': 2.5,
    } as any,
  },
]

function getConnectionsForNode(nodeId: string): ActiveConnection[] {
  const conns: ActiveConnection[] = []
  cytoscapeEdges.forEach(e => {
    if (e.data.source === nodeId) {
      conns.push({ direction: 'outbound', target: e.data.target, latency: e.data.latency, isAnomaly: e.data.type === 'anomaly' })
    } else if (e.data.target === nodeId) {
      conns.push({ direction: 'inbound', target: e.data.source, latency: e.data.latency, isAnomaly: e.data.type === 'anomaly' })
    }
  })
  return conns
}

function NodeExplorerPanel({ node, onClose }: { node: CytoscapeNodeData; onClose: () => void }) {
  const connections = getConnectionsForNode(node.id)
  const trafficPoints = (node.trafficData ?? []).map((v, i) => ({ i, v }))
  const { addAlert } = useAppContext()

  return (
    <div className="absolute top-0 right-0 h-full w-[270px] bg-surface-raised border-l border-surface-border z-10 flex flex-col animate-slide-in-right">
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-sentinel-100">Node Explorer</h2>
        <button onClick={onClose} className="p-1 rounded text-sentinel-500 hover:text-sentinel-200"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Node identity */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-3">
          <p className="font-mono text-[11px] text-sentinel-400 mb-0.5">ID: {node.id}</p>
          <p className="text-xs text-sentinel-200">{node.description}</p>
        </div>

        {/* Stats 2×2 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-surface-card border border-surface-border rounded-lg p-2.5">
            <p className="section-label mb-1">Status</p>
            <div className="flex items-center gap-1.5">
              <StatusDot status={node.status} pulse={node.status === 'critical'} />
              <span className={`text-xs font-semibold ${node.status === 'critical' ? 'text-severity-critical' : 'text-sentinel-200'}`}>
                {node.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-lg p-2.5">
            <p className="section-label mb-1">Risk Score</p>
            <p className={`text-2xl font-bold ${node.riskScore >= 80 ? 'text-severity-critical' : 'text-sentinel-100'}`}>
              {node.riskScore}<span className="text-xs text-sentinel-400">/100</span>
            </p>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-lg p-2.5">
            <p className="section-label mb-1">Type</p>
            <p className="text-xs font-medium text-sentinel-200 capitalize">{node.type}</p>
          </div>
          <div className="bg-surface-card border border-surface-border rounded-lg p-2.5">
            <p className="section-label mb-1">Uptime</p>
            <p className="font-mono text-xs text-sentinel-200">{node.uptime ?? 'N/A'}</p>
          </div>
        </div>

        {/* Traffic anomaly chart */}
        <div className="bg-surface-card border border-surface-border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">Traffic Anomaly (24h)</p>
            {node.status === 'critical' && (
              <span className="text-[10px] font-medium text-accent-coral bg-accent-coral/10 border border-accent-coral/30 px-1.5 py-0.5 rounded">
                +340% SPIKE
              </span>
            )}
          </div>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trafficPoints}>
                <Line type="monotone" dataKey="v" stroke="#fb7185" strokeWidth={1.5} dot={false} />
                <Tooltip contentStyle={{ background: '#0c1220', border: '1px solid #1e293b', fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Connections */}
        <div>
          <p className="section-label mb-2">Connections (Active)</p>
          {connections.map((c, i) => (
            <div key={i}
              className={`flex items-center gap-2 py-2 border-b border-surface-border last:border-0 ${c.isAnomaly ? 'border-l-2 border-l-severity-critical pl-2' : ''}`}>
              {c.direction === 'outbound'
                ? <ArrowRight className="w-3 h-3 text-sentinel-400 shrink-0" />
                : <ArrowLeft  className="w-3 h-3 text-sentinel-400 shrink-0" />}
              <span className="font-mono text-[11px] text-sentinel-200 flex-1">{c.target}</span>
              <span className={`text-[10px] font-medium ${c.isAnomaly ? 'text-severity-critical' : 'text-sentinel-400'}`}>
                {c.latency ?? '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Isolate button */}
      <div className="px-4 py-3 border-t border-surface-border shrink-0">
        <button
          onClick={() => addAlert({ severity: 'critical', title: `Node ${node.id} Isolated`, description: `Manual isolation triggered. All connections severed. Quarantine active.`, nodeId: node.id })}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent-rose/10 border border-accent-rose/30 text-accent-rose text-xs font-semibold hover:bg-accent-rose/20 transition-colors">
          <AlertTriangle className="w-3.5 h-3.5" /> ISOLATE NODE
        </button>
      </div>
    </div>
  )
}

export default function NetworkMap() {
  const [activeTab, setActiveTab] = useState('Network Graph')
  const [selectedNode, setSelectedNode] = useState<CytoscapeNodeData | null>(null)
  const [zoom, setZoom] = useState(100)
  const [cyRef, setCyRef] = useState<any>(null)

  const { data: nodes, loading } = useApi(networkApi.graphNodes)

  const elements = [
    ...(nodes ?? []).map(n => ({ data: n.data, position: n.position })),
    ...cytoscapeEdges.map(e => ({ data: e.data })),
  ]

  const handleNodeClick = useCallback((evt: any) => {
    const node = evt.target
    if (node.isNode && node.isNode()) {
      setSelectedNode(node.data() as CytoscapeNodeData)
    }
  }, [])

  function zoomIn()  { if (cyRef) { cyRef.zoom(cyRef.zoom() * 1.2); setZoom(Math.round(cyRef.zoom()*100)) } }
  function zoomOut() { if (cyRef) { cyRef.zoom(cyRef.zoom() / 1.2); setZoom(Math.round(cyRef.zoom()*100)) } }

  return (
    <div className="flex flex-col h-full">
      <TabBar tabs={['Network Graph','Node Explorer','Anomalies']} active={activeTab} onChange={setActiveTab}
        className="px-4 bg-surface-raised shrink-0" />

      <div className="flex-1 relative overflow-hidden">
        {/* Dot-grid canvas */}
        <div className="absolute inset-0 dot-grid opacity-50" />

        {loading ? (
          <SkeletonGraph />
        ) : (
          <ErrorBoundary label="Network graph failed to render">
            <CytoscapeComponent
              elements={elements}
              stylesheet={CY_STYLESHEET}
              style={{ width: '100%', height: '100%', background: 'transparent' }}
              cy={(cy: cytoscape.Core) => {
                setCyRef(cy)
                cy.on('tap', 'node', handleNodeClick)
                cy.on('tap', function(e: cytoscape.EventObject) {
                  if (e.target === cy) setSelectedNode(null)
                })
              }}
              layout={{ name: 'preset' }}
              userZoomingEnabled
              userPanningEnabled
            />
          </ErrorBoundary>
        )}

        {/* Bottom control bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-surface-raised/90 border border-surface-border rounded-xl px-3 py-2 backdrop-blur-sm">
          <button onClick={zoomOut} className="p-1.5 rounded text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
          <span className="font-mono text-[11px] text-sentinel-300 w-10 text-center">{zoom}%</span>
          <button onClick={zoomIn}  className="p-1.5 rounded text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover transition-colors"><ZoomIn  className="w-3.5 h-3.5" /></button>
          <div className="w-px h-4 bg-surface-border mx-1" />
          <button className="p-1.5 rounded text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover transition-colors"><Move className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded text-sentinel-400 hover:text-sentinel-200 hover:bg-surface-hover transition-colors"><Grid3x3 className="w-3.5 h-3.5" /></button>
          <div className="w-px h-4 bg-surface-border mx-1" />
          <span className="text-[10px] text-sentinel-400">FILTER:</span>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-severity-critical/10 text-severity-critical border border-severity-critical/20">Risk: Critical</span>
        </div>

        {/* Node Explorer panel */}
        {selectedNode && <NodeExplorerPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
      </div>
    </div>
  )
}
