import type { AuditEntry, PolicyDirective, NodeIntegrity, ClearanceLevelItem, SecurityDirective } from '../types'

export const auditLog: AuditEntry[] = [
  { id:'1', timestamp:'2023-10-27\n14:32:01.442', operatorId:'OP-774A',  actionType:'Protocol Escalation',    targetEntity:'Node_Delta_V9',    risk:'high',   status:'success' },
  { id:'2', timestamp:'2023-10-27\n14:30:15.912', operatorId:'OP-219C',  actionType:'Data Export (Encrypted)', targetEntity:'Archive_Sector_4',  risk:'low',    status:'denied'  },
  { id:'3', timestamp:'2023-10-27\n14:28:44.101', operatorId:'SYS-AUTO', actionType:'Policy Sync Check',       targetEntity:'Global_Registry',   risk:'low',    status:'success' },
  { id:'4', timestamp:'2023-10-27\n14:25:33.007', operatorId:'OP-441B',  actionType:'Node Isolation',          targetEntity:'BLR-SRV-01',        risk:'high',   status:'success' },
  { id:'5', timestamp:'2023-10-27\n14:22:17.884', operatorId:'SYS-AUTO', actionType:'Clearance Renewal',       targetEntity:'HUB-OP-22',         risk:'low',    status:'success' },
  { id:'6', timestamp:'2023-10-27\n14:19:05.220', operatorId:'OP-774A',  actionType:'Firewall Rule Update',    targetEntity:'Perimeter_FW_01',   risk:'medium', status:'success' },
  { id:'7', timestamp:'2023-10-27\n14:15:49.661', operatorId:'OP-102X',  actionType:'Access Attempt',          targetEntity:'TS-Archive_Alpha',  risk:'high',   status:'denied'  },
  { id:'8', timestamp:'2023-10-27\n14:12:30.009', operatorId:'SYS-AUTO', actionType:'Integrity Scan',          targetEntity:'Global_Registry',   risk:'low',    status:'success' },
]

export const policyDirectives: PolicyDirective[] = [
  {
    id:'1', dirCode:'DIR-2023-09A', icon:'key',
    name:'Global Multi-Factor Mandate (Tier 1-3)',
    description:'Requires hardware token authentication for all intra-network access originating outside designated safe zones.',
    status:'enforced', enabled:true, tags:['Access: T1-T3','Impact: High'], enforcementProgress:100,
  },
  {
    id:'2', dirCode:'DIR-2023-11C', icon:'warning',
    name:'Telemetry Retention Override - Sector 7',
    description:'Forces 90-day retention of all raw packet data in Sector 7 due to ongoing anomalous traffic analysis.',
    status:'alert', enabled:true, tags:['Region: S7','Compliance Risk'], enforcementProgress:62,
  },
]

export const securityDirectives: SecurityDirective[] = [
  { id:'1', dirCode:'DIR-2023-09A', title:'Enforce MFA Level 3',
    description:'Mandatory biometric authentication enforcement for all cross-region data...', enforcementProgress:100 },
  { id:'2', dirCode:'DIR-2023-11C', title:'Zero-Trust Network Patch',
    description:'Immediate deployment of ZTNA micro-segmentation rules across legacy...', enforcementProgress:62  },
  { id:'3', dirCode:'DIR-2023-12F', title:'Deprecated API Sunset',
    description:'Halt all traffic to v1.2 telemetry endpoints due to identified CVE-202...', enforcementProgress:14  },
]

export const nodeIntegrity: NodeIntegrity[] = [
  { nodeId:'ND-ALPHA-01', description: 'Core API Gateway', type: 'gateway', status: 'healthy', integrityScore: 100, lastVerified: '2 mins ago' },
  { nodeId:'ND-BETA-44',  description: 'Authentication Service', type: 'service', status: 'healthy', integrityScore: 98, lastVerified: '5 mins ago' },
  { nodeId:'ND-GAMMA-12', description: 'Legacy Database Shard', type: 'database', status: 'degraded', integrityScore: 65, lastVerified: '10 mins ago' },
  { nodeId:'ND-DELTA-09', description: 'External Proxy Endpoint', type: 'proxy', status: 'compromised', integrityScore: 12, lastVerified: '1 min ago' },
  { nodeId:'ND-EPSILON-05', description: 'Backup Storage Volume', type: 'storage', status: 'offline', integrityScore: 0, lastVerified: '1 hour ago' },
]

export const clearanceLevels: ClearanceLevelItem[] = [
  { code:'CL-5', name: 'Command Level', level: 5, activeCount:12, description: 'Full system authority, override capability, and global directive issuance.' },
  { code:'CL-4', name: 'Strategic', level: 4, activeCount:84, description: 'Regional command, intelligence routing, and protocol management.' },
  { code:'CL-3', name: 'Operational', level: 3, activeCount:412, description: 'Standard analyst clearance. Read access to case files and telemetry.' },
]
