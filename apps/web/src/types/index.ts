// ─── Shared Enums / Scalars ───────────────────────────────────────────────────
export type Severity = 'critical' | 'elevated' | 'low' | 'info'
export type MapMode  = 'default'  | 'zone'     | 'network'

// ─── Cases ────────────────────────────────────────────────────────────────────
export type CaseStatus   = 'in_progress' | 'open' | 'resolved' | 'escalated'
export type CaseCategory = 'geo_political' | 'infrastructure' | 'personnel' | 'cyber' | 'financial'

export interface TimelineEvent {
  id: string
  type: 'threat' | 'account' | 'analyst' | 'system'
  title: string
  description: string
  timestamp: string
  severity?: Severity
}
export interface CommMessage {
  id: string; sender: string; senderCode: string
  content: string; timestamp: string; side: 'left' | 'right'
}
export interface LinkedNode {
  id: string; name: string; ip: string
  status: 'active' | 'critical' | 'offline'; icon: 'server' | 'database'
}
export interface PersonaAccount {
  id: string; name: string; statusTag: string; compromised: boolean
}
export interface Case {
  id: string; caseId: string; title: string
  severity: Severity; category: CaseCategory; status: CaseStatus
  assignee: string; activeSince: string
  timeline: TimelineEvent[]; comms: CommMessage[]
  linkedNodes: LinkedNode[]; personas: PersonaAccount[]; threatVectors: string[]
}

// ─── Geo / Districts ──────────────────────────────────────────────────────────
export interface RiskDriver   { label: string; value: number; color: 'rose' | 'amber' | 'blue' }
export interface PriorityEntity {
  id: string; name: string; sector: string
  status: 'critical' | 'elevated' | 'normal'
  icon: 'wifi' | 'bus' | 'building' | 'medical' | 'server'
}
export interface District {
  id: string; name: string; totalIncidents: number; riskScore: number; trend: number
  lat: number; lng: number; trendData: number[]
  priorityEntities: PriorityEntity[]; riskDrivers: RiskDriver[]
}
export interface HeatmapPoint { lat: number; lng: number; intensity: number }
export interface GeoNetworkNode {
  id: string; name: string; lat: number; lng: number
  type: 'primary' | 'secondary' | 'hub'; status: 'active' | 'critical' | 'normal'
}
export interface GeoNetworkEdge {
  source: string; target: string; type: 'high_volume' | 'latent'
}
export interface NetworkRelationship { label: string; level: 'high' | 'elevated'; value: number }
export interface AnomalyAlert { id: string; type: 'warning' | 'info'; title: string; description: string }

// ─── Network / Cytoscape ──────────────────────────────────────────────────────
export type NodeType   = 'infrastructure' | 'persona' | 'organization' | 'gateway' | 'unknown'
export type NodeStatus = 'normal' | 'critical' | 'warning' | 'offline'
export type EdgeType   = 'normal' | 'anomaly' | 'high_volume' | 'latent'

export interface CytoscapeNodeData {
  id: string; label: string; type: NodeType; status: NodeStatus
  riskScore: number; description?: string; uptime?: string; trafficData?: number[]
}
export interface CytoscapeNode  { data: CytoscapeNodeData; position: { x: number; y: number } }
export interface CytoscapeEdge  { data: { id: string; source: string; target: string; type: EdgeType; latency?: string } }
export interface NetworkNode {
  id: string; label: string; type: NodeType; status: NodeStatus
  riskScore: number; connections: number; trafficVol24h: number
  trafficUnit: 'T' | 'G' | 'M'; lastSignal: string
  region?: string; encryption?: string; uptime?: string; description?: string
}
export interface ActiveConnection {
  direction: 'inbound' | 'outbound'; target: string; latency?: string; isAnomaly: boolean
}

// ─── Governance ───────────────────────────────────────────────────────────────
export type AuditRisk             = 'high' | 'medium' | 'low'
export type AuditStatus           = 'success' | 'denied' | 'pending'
export type PolicyStatus          = 'enforced' | 'alert' | 'pending'
export type NodeIntegrityStatus   = 'healthy' | 'degraded' | 'compromised' | 'offline'

export interface AuditEntry {
  id: string; timestamp: string; operatorId: string
  actionType: string; targetEntity: string; risk: AuditRisk; status: AuditStatus
}
export interface PolicyDirective {
  id: string; dirCode: string; icon: 'key' | 'warning' | 'shield'
  name: string; description: string; status: PolicyStatus
  enabled: boolean; tags: string[]; enforcementProgress: number
}
export interface ClearanceLevelItem {
  code: string; name: string; level: number; activeCount: number; description: string
}
export interface NodeIntegrity {
  nodeId: string; description: string; type: string; status: NodeIntegrityStatus; integrityScore: number; lastVerified: string;
}
export interface SecurityDirective {
  id: string; dirCode: string; title: string; description: string; enforcementProgress: number
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface CorrelationCell { row: string; col: string; value: number }
export interface TemporalDataPoint { quarter: string; current: number; baseline: number; isAnomaly?: boolean }
export interface StatisticalOutlier {
  id: string; vector: string; timeDelta: string; description: string; severity: Severity
}
export interface SectorDistribution { name: string; value: number; color: string }
