import type { District, HeatmapPoint, GeoNetworkNode, GeoNetworkEdge } from '../types'

export const karnatakaDistricts: District[] = [
  {
    id: 'bengaluru-urban', name: 'Bengaluru Urban',
    totalIncidents: 1492, riskScore: 78, trend: 12,
    lat: 12.9716, lng: 77.5946,
    trendData: [45, 52, 48, 61, 58, 73, 88, 95],
    priorityEntities: [
      { id: 'e1', name: 'Node-BLR-01',   sector: 'Sector 4',      status: 'critical', icon: 'wifi'    },
      { id: 'e2', name: 'Transit-Hub-K', sector: 'Sector 9',      status: 'elevated', icon: 'bus'     },
      { id: 'e3', name: 'Corp-Campus-E', sector: 'Electronic City',status: 'normal',   icon: 'building'},
      { id: 'e4', name: 'Med-Center-S',  sector: 'South Sector',  status: 'normal',   icon: 'medical' },
    ],
    riskDrivers: [
      { label: 'Social Unrest',               value: 45, color: 'rose'  },
      { label: 'Infrastructure Vulnerability', value: 30, color: 'amber' },
      { label: 'Network Anomalies',            value: 25, color: 'blue'  },
    ],
  },
  {
    id: 'hubballi-dharwad', name: 'Hubballi-Dharwad',
    totalIncidents: 843, riskScore: 85, trend: 18,
    lat: 15.3647, lng: 75.1239,
    trendData: [60, 72, 68, 85, 90, 105, 120, 115],
    priorityEntities: [
      { id: 'e1', name: 'node-HUB-02', sector: 'Sector 1', status: 'critical', icon: 'wifi' },
    ],
    riskDrivers: [
      { label: 'Social Unrest',               value: 55, color: 'rose'  },
      { label: 'Infrastructure Vulnerability', value: 28, color: 'amber' },
      { label: 'Network Anomalies',            value: 17, color: 'blue'  },
    ],
  },
  {
    id: 'mysuru', name: 'Mysuru',
    totalIncidents: 421, riskScore: 52, trend: -3,
    lat: 12.2958, lng: 76.6394,
    trendData: [30, 28, 35, 32, 40, 38, 42, 39],
    priorityEntities: [
      { id: 'e1', name: 'Hub-MYS-05', sector: 'Sector 3', status: 'elevated', icon: 'server' },
    ],
    riskDrivers: [
      { label: 'Social Unrest',               value: 30, color: 'rose'  },
      { label: 'Infrastructure Vulnerability', value: 45, color: 'amber' },
      { label: 'Network Anomalies',            value: 25, color: 'blue'  },
    ],
  },
  {
    id: 'mangaluru', name: 'Mangaluru',
    totalIncidents: 312, riskScore: 41, trend: 5,
    lat: 12.9141, lng: 74.856,
    trendData: [20, 22, 25, 28, 30, 32, 31, 33],
    priorityEntities: [],
    riskDrivers: [
      { label: 'Social Unrest',               value: 25, color: 'rose'  },
      { label: 'Infrastructure Vulnerability', value: 40, color: 'amber' },
      { label: 'Network Anomalies',            value: 35, color: 'blue'  },
    ],
  },
  {
    id: 'belagavi', name: 'Belagavi',
    totalIncidents: 289, riskScore: 38, trend: 2,
    lat: 15.8497, lng: 74.4977,
    trendData: [18, 20, 22, 24, 26, 28, 27, 29],
    priorityEntities: [],
    riskDrivers: [
      { label: 'Social Unrest',               value: 35, color: 'rose'  },
      { label: 'Infrastructure Vulnerability', value: 35, color: 'amber' },
      { label: 'Network Anomalies',            value: 30, color: 'blue'  },
    ],
  },
]

export const heatmapPoints: HeatmapPoint[] = [
  { lat: 15.36, lng: 75.12, intensity: 1.0  },
  { lat: 15.40, lng: 75.10, intensity: 0.9  },
  { lat: 15.32, lng: 75.16, intensity: 0.85 },
  { lat: 15.38, lng: 75.20, intensity: 0.75 },
  { lat: 12.97, lng: 77.59, intensity: 0.9  },
  { lat: 13.00, lng: 77.55, intensity: 0.8  },
  { lat: 12.94, lng: 77.62, intensity: 0.75 },
  { lat: 12.29, lng: 76.64, intensity: 0.55 },
  { lat: 12.31, lng: 76.68, intensity: 0.45 },
  { lat: 12.91, lng: 74.86, intensity: 0.45 },
  { lat: 15.85, lng: 74.50, intensity: 0.40 },
  { lat: 17.33, lng: 76.83, intensity: 0.35 },
  { lat: 14.16, lng: 75.72, intensity: 0.30 },
  { lat: 13.34, lng: 77.10, intensity: 0.30 },
  { lat: 14.46, lng: 75.92, intensity: 0.25 },
  { lat: 13.92, lng: 75.57, intensity: 0.25 },
]

export const geoNetworkNodes: GeoNetworkNode[] = [
  { id: 'node-HUB-02', name: 'node-HUB-02', lat: 15.3647, lng: 75.1239, type: 'primary',   status: 'critical' },
  { id: 'node-BLR-01', name: 'node-BLR-01', lat: 12.9716, lng: 77.5946, type: 'primary',   status: 'active'   },
  { id: 'Hub-MYS-05',  name: 'Hub-MYS-05',  lat: 12.2958, lng: 76.6394, type: 'hub',       status: 'normal'   },
  { id: 'node-MNG-03', name: 'node-MNG-03', lat: 12.9141, lng: 74.856,  type: 'secondary', status: 'normal'   },
  { id: 'node-BLG-01', name: 'node-BLG-01', lat: 15.8497, lng: 74.4977, type: 'secondary', status: 'normal'   },
  { id: 'node-KLB-01', name: 'node-KLB-01', lat: 17.3297, lng: 76.8343, type: 'secondary', status: 'normal'   },
  { id: 'node-DVG-01', name: 'node-DVG-01', lat: 14.4663, lng: 75.9238, type: 'secondary', status: 'normal'   },
]

export const geoNetworkEdges: GeoNetworkEdge[] = [
  { source: 'node-HUB-02', target: 'node-BLR-01', type: 'high_volume' },
  { source: 'node-BLR-01', target: 'Hub-MYS-05',  type: 'high_volume' },
  { source: 'node-HUB-02', target: 'node-BLG-01', type: 'high_volume' },
  { source: 'node-HUB-02', target: 'node-MNG-03', type: 'latent'      },
  { source: 'node-BLR-01', target: 'node-KLB-01', type: 'latent'      },
  { source: 'node-HUB-02', target: 'node-DVG-01', type: 'latent'      },
]
