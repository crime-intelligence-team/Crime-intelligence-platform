import type { CytoscapeNode, CytoscapeEdge, NetworkNode } from '../types'

export const cytoscapeNodes: CytoscapeNode[] = [
  {
    data: { id: 'EU-GATE-01', label: 'EU-GATE-01', type: 'gateway', status: 'normal', riskScore: 24,
      description: 'European Gateway Router - Frankfurt Hub', uptime: '99.9%',
      trafficData: [10,12,11,13,12,14,13,15,12,11] },
    position: { x: 320, y: 280 },
  },
  {
    data: { id: 'BLR-SRV-01', label: 'BLR-SRV-01', type: 'infrastructure', status: 'critical', riskScore: 88,
      description: 'Core Infrastructure Router - Bangalore Data Center', uptime: '99.9%',
      trafficData: [20,22,25,30,45,80,120,340,290,180] },
    position: { x: 430, y: 430 },
  },
  {
    data: { id: 'EXT-PROXY-99', label: 'EXT-PROXY-99', type: 'unknown', status: 'critical', riskScore: 97,
      description: 'External Proxy - Unknown Origin', uptime: 'N/A',
      trafficData: [5,8,12,20,35,60,95,120,130,115] },
    position: { x: 600, y: 340 },
  },
  {
    data: { id: 'DB-SHARD-4', label: 'DB-SHARD-4', type: 'infrastructure', status: 'normal', riskScore: 15,
      description: 'Database Shard 4 - Tier 1 Storage', uptime: '99.99%',
      trafficData: [8,9,8,10,9,11,10,9,8,10] },
    position: { x: 310, y: 580 },
  },
  {
    data: { id: 'UKN-HOST', label: 'UKN-HOST', type: 'unknown', status: 'warning', riskScore: 62,
      description: 'Unidentified Host - Monitoring Active', uptime: 'Unknown',
      trafficData: [2,3,5,4,6,8,7,9,8,10] },
    position: { x: 690, y: 500 },
  },
]

export const cytoscapeEdges: CytoscapeEdge[] = [
  { data: { id: 'e1', source: 'EU-GATE-01',   target: 'BLR-SRV-01',   type: 'normal',  latency: '45ms'   } },
  { data: { id: 'e2', source: 'BLR-SRV-01',   target: 'EXT-PROXY-99', type: 'anomaly', latency: 'ANOMALY'} },
  { data: { id: 'e3', source: 'BLR-SRV-01',   target: 'DB-SHARD-4',   type: 'normal',  latency: '12ms'   } },
  { data: { id: 'e4', source: 'EXT-PROXY-99', target: 'UKN-HOST',     type: 'anomaly'                     } },
]

export const entityRegistry: NetworkNode[] = [
  { id: 'SYS-ND-8834', label: 'SYS-ND-8834', type: 'infrastructure', status: 'critical',
    riskScore: 94, connections: 1204, trafficVol24h: 8.4, trafficUnit: 'T', lastSignal: '12s ago',
    region: 'AP-SOUTH-1', encryption: 'AES-256-GCM', uptime: '99.9%' },
  { id: 'PRN-OP-102',  label: 'PRN-OP-102',  type: 'persona',        status: 'normal',
    riskScore: 45, connections: 42,   trafficVol24h: 1.2, trafficUnit: 'G', lastSignal: '2m ago'  },
  { id: 'ORG-X-99',   label: 'ORG-X-99',   type: 'organization',   status: 'normal',
    riskScore: 12, connections: 8930, trafficVol24h: 45,  trafficUnit: 'T', lastSignal: '1h ago'  },
  { id: 'SYS-GT-401', label: 'SYS-GT-401', type: 'gateway',         status: 'warning',
    riskScore: 76, connections: 432,  trafficVol24h: 3.1, trafficUnit: 'T', lastSignal: '45s ago' },
]
